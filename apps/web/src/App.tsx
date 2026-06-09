import type {
  CvAnalysis,
  CvJdMatch,
  InterviewLanguage,
  InterviewSession,
  InterviewTurn,
  JdAnalysis,
  NextQuestionResponse,
  Question,
  StoredInterview
} from "@preptalk/shared";
import { predefinedRoles } from "@preptalk/shared";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ApiError, getHealthStatus } from "./api/client";
import {
  startInterview,
  submitAnswer,
  suggestAnswer,
  getNextQuestion,
  parseCv,
  analyzeJd,
  matchCvJd,
} from "./api/client";
import { WhisperTranscriber } from "./lib/transcriber";
import { AudioCapture } from "./lib/audio-capture";
import type { ActiveSpeechCapture } from "./lib/audio";
import {
  ensureMicrophoneAccess,
  ensureSpeechRecognitionSupport,
  speakText,
  startSpeechCapture,
  stopSpeech
} from "./lib/audio";
import {
  clearStoredInterview,
  loadStoredInterview,
  saveStoredInterview
} from "./lib/storage";

// Import refactored screens
import { ParticlesBackground, GradientOrbs } from "./components/Background";
import { SetupScreen } from "./components/SetupScreen";
import { ReadinessScreen } from "./components/ReadinessScreen";
import { InterviewScreen } from "./components/InterviewScreen";
import { SummaryScreen } from "./components/SummaryScreen";

type AppStage = "setup" | "readiness" | "interview" | "summary";
type WorkStatus = "idle" | "starting" | "playing" | "suggesting" | "recording" | "submitting";

const customRoleValue = "__custom_role__";
const defaultRole = "Backend Engineer .NET";

// ── localStorage keys ──
const LS_CV = "preptalk_cv";
const LS_JD = "preptalk_jd";
const LS_MATCH = "preptalk_match";

const loadFromLs = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch { return null; }
};

const saveToLs = (key: string, value: unknown): void => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
};

const clearLs = (key: string): void => {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
};

export const App = () => {
  const [stage, setStage] = useState<AppStage>("setup");
  const [workStatus, setWorkStatus] = useState<WorkStatus>("idle");
  const [candidateName, setCandidateName] = useState<string>("");
  const [language, setLanguage] = useState<InterviewLanguage>("en");
  const [selectedRole, setSelectedRole] = useState<string>(defaultRole);
  const [customRole, setCustomRole] = useState<string>("");
  const [yearsOfExperience, setYearsOfExperience] = useState<string>("0-1 years");
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [history, setHistory] = useState<InterviewTurn[]>([]);
  const [suggestedAnswer, setSuggestedAnswer] = useState<string | null>(null);
  const [speakingTips, setSpeakingTips] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [storedInterview, setStoredInterview] = useState<StoredInterview | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [cvAnalysis, setCvAnalysis] = useState<CvAnalysis | null>(loadFromLs<CvAnalysis>(LS_CV));
  const [jdAnalysis, setJdAnalysis] = useState<JdAnalysis | null>(loadFromLs<JdAnalysis>(LS_JD));
  const [cvJdMatch, setCvJdMatch] = useState<CvJdMatch | null>(loadFromLs<CvJdMatch>(LS_MATCH));
  const [isParsingCv, setIsParsingCv] = useState(false);
  const [isAnalyzingJd, setIsAnalyzingJd] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [whisperStatus, setWhisperStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const whisperRef = useRef<WhisperTranscriber | null>(null);
  const audioCaptureRef = useRef<AudioCapture | null>(null);
  const activeSpeechCaptureRef = useRef<ActiveSpeechCapture | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const stopCurrentPlayback = (): void => {
    stopSpeech();
  };

  useEffect((): (() => void) => {
    setStoredInterview(loadStoredInterview());

    return (): void => {
      stopSpeech();
    };
  }, []);

  // Lazy-load Whisper model when entering interview stage
  useEffect(() => {
    if (stage !== "interview" || whisperStatus !== "idle" || !language) return;

    setWhisperStatus("loading");
    const transcriber = new WhisperTranscriber({
      language,
      onReady: () => setWhisperStatus("ready"),
      onError: () => setWhisperStatus("error"),
      onTranscript: () => {},
    });
    whisperRef.current = transcriber;
    transcriber.loadModel().catch(() => setWhisperStatus("error"));

    return () => {
      transcriber.terminate();
      whisperRef.current = null;
      setWhisperStatus("idle");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const resolvedRole = useMemo((): string => {
    if (selectedRole === customRoleValue) {
      return customRole.trim();
    }

    return selectedRole;
  }, [customRole, selectedRole]);

  const lastTurn = history.length > 0 ? history[history.length - 1] : null;
  const canUseInterviewActions = session !== null && currentQuestion !== null && workStatus !== "starting";
  const isBusy = workStatus !== "idle" && workStatus !== "recording";

  const persistInterview = (
    nextSession: InterviewSession,
    nextCurrentQuestion: Question | null,
    nextPendingQuestion: Question | null,
    nextHistory: InterviewTurn[]
  ): void => {
    saveStoredInterview({
      session: nextSession,
      currentQuestion: nextCurrentQuestion,
      pendingNextQuestion: nextPendingQuestion,
      history: nextHistory,
      updatedAt: new Date().toISOString()
    });
  };

  const handleProfileSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setErrorMessage(null);
    setNoticeMessage(null);

    if (candidateName.trim().length === 0) {
      setErrorMessage("Please enter your name.");
      return;
    }

    if (resolvedRole.length < 2) {
      setErrorMessage("Please choose or enter the role you want to practice.");
      return;
    }

    setStage("readiness");
  };

  // ── CV / JD Handlers ──

  const handleCvUpload = async (file: File): Promise<void> => {
    setErrorMessage(null);
    setIsParsingCv(true);
    try {
      const cv = await parseCv(file);
      setCvAnalysis(cv);
      saveToLs(LS_CV, cv);
      // Auto-fill name from CV if empty
      if (!candidateName.trim() && cv.candidateName) {
        setCandidateName(cv.candidateName);
      }
      // Auto-fill role from CV if it matches a predefined role
      if (cv.experience.length > 0 && cv.experience[0]) {
        const latestRole = cv.experience[0].role;
        const matched = predefinedRoles.find(r => r.toLowerCase().includes(latestRole.toLowerCase()) || latestRole.toLowerCase().includes(r.toLowerCase()));
        if (matched) setSelectedRole(matched);
      }
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsParsingCv(false);
    }
  };

  const handleSkipCv = (): void => {
    // No-op, just proceed
  };

  const handleJdTextChange = (_value: string): void => {
    // JD text is managed locally in SetupScreen
  };

  const handleAnalyzeJd = async (jdText: string): Promise<void> => {
    if (jdText.trim().length < 20) {
      setErrorMessage("Please provide a job description (at least 20 characters).");
      return;
    }
    setErrorMessage(null);
    setIsAnalyzingJd(true);
    try {
      const jd = await analyzeJd(jdText);
      setJdAnalysis(jd);
      saveToLs(LS_JD, jd);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsAnalyzingJd(false);
    }
  };

  const handleSkipJd = (): void => {
    // No-op, just proceed
  };

  const handleMatchCvJd = async (): Promise<void> => {
    if (!cvAnalysis || !jdAnalysis) return;
    setErrorMessage(null);
    setIsMatching(true);
    try {
      const match = await matchCvJd(cvAnalysis, jdAnalysis);
      setCvJdMatch(match);
      saveToLs(LS_MATCH, match);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsMatching(false);
    }
  };

  const handleConfirmReady = async (): Promise<void> => {
    setErrorMessage(null);
    setNoticeMessage(null);
    setWorkStatus("starting");

    try {
      ensureSpeechRecognitionSupport();
      await ensureMicrophoneAccess();

      const healthStatus = await getHealthStatus();

      if (!healthStatus.openRouterConfigured) {
        throw new ApiError("The AI interviewer is not configured. Please check your local setup and restart the app.", "CONFIG_MISSING", null);
      }

      const response = await startInterview({
        candidateName: candidateName.trim(),
        language,
        role: resolvedRole,
        yearsOfExperience,
        cvAnalysis,
        jdAnalysis,
        cvJdMatch,
      });

      setSession(response.session);
      setCurrentQuestion(response.question);
      setHistory([]);
      setSuggestedAnswer(null);
      setSpeakingTips([]);
      persistInterview(response.session, response.question, null, []);
      setStoredInterview(null);
      setStage("interview");
      setWorkStatus("idle");
      await playQuestion(response.question.text, response.session.language);
    } catch (error: unknown) {
      setWorkStatus("idle");
      setErrorMessage(getErrorMessage(error));
    }
  };

  const handleReplayQuestion = async (): Promise<void> => {
    if (currentQuestion === null || session === null) {
      return;
    }

    await playQuestion(currentQuestion.text, session.language);
  };

  const handleSuggestAnswer = async (): Promise<void> => {
    if (session === null || currentQuestion === null) {
      return;
    }

    setErrorMessage(null);
    setNoticeMessage(null);
    setWorkStatus("suggesting");

    try {
      const response = await suggestAnswer({
        session,
        question: currentQuestion,
        history
      });
      setSuggestedAnswer(response.suggestedAnswer);
      setSpeakingTips(response.speakingTips);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setWorkStatus("idle");
    }
  };

  const handleStartRecording = (): void => {
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      if (session === null) {
        return;
      }

      stopCurrentPlayback();

      // If Whisper is ready, use AudioCapture pipeline
      if (whisperRef.current?.isModelLoaded) {
        audioCaptureRef.current = new AudioCapture();
        audioCaptureRef.current.start();
        setWorkStatus("recording");
        return;
      }

      // Fallback to Web Speech API
      if (navigator.mediaDevices?.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
          micStreamRef.current = stream;
          setMicStream(stream);
        }).catch(() => {
          // Silently fail — visualizer will show no data
        });
      }

      activeSpeechCaptureRef.current = startSpeechCapture(session.language);
      setWorkStatus("recording");
    } catch (error: unknown) {
      setWorkStatus("idle");
      setErrorMessage(getErrorMessage(error));
    }
  };

  // Cache for prefetched next question
  const prefetchedNextQuestionRef = useRef<NextQuestionResponse | null>(null);
  const prefetchSessionRef = useRef<InterviewSession | null>(null);

  const handleStopRecording = async (): Promise<void> => {
    setErrorMessage(null);
    setNoticeMessage(null);

    // Whisper path
    if (audioCaptureRef.current && whisperRef.current?.isModelLoaded) {
      try {
        const audio = audioCaptureRef.current.stop();
        audioCaptureRef.current = null;

        if (audio.length < 16000) {
          throw new Error("Your answer was too short. Please speak a little longer and try again.");
        }

        setWorkStatus("submitting");

        const transcript = await whisperRef.current.transcribeFloat32Array(audio, language);

        if (transcript.trim().length < 2) {
          throw new Error("Could not understand your speech. Please try again.");
        }

        // Submit to server
        if (session === null || currentQuestion === null) return;
        const response = await submitAnswer({
          session,
          question: currentQuestion,
          history,
          transcript,
        });

        const nextHistory = [...history, response.turn];
        setSession(response.session);
        setHistory(nextHistory);
        setSuggestedAnswer(null);
        setSpeakingTips([]);
        persistInterview(response.session, currentQuestion, null, nextHistory);

        // Prefetch next question
        prefetchSessionRef.current = response.session;
        getNextQuestion({
          session: response.session,
          history: nextHistory,
        }).then((nextResponse) => {
          prefetchedNextQuestionRef.current = nextResponse;
        }).catch(() => {
          prefetchedNextQuestionRef.current = null;
        });
      } catch (error: unknown) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setWorkStatus("idle");
      }
      return;
    }

    // Web Speech API fallback path (original code)
    if (session === null || currentQuestion === null || activeSpeechCaptureRef.current === null) {
      return;
    }

    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      const speechCapture = await activeSpeechCaptureRef.current.stop();
      activeSpeechCaptureRef.current = null;

      // Stop mic stream for visualizer
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
        micStreamRef.current = null;
        setMicStream(null);
      }

      setWorkStatus("submitting");

      if (speechCapture.durationMs < 700 || speechCapture.transcript.length < 2) {
        throw new Error("Your answer was too short. Please speak a little longer and try again.");
      }

      const response = await submitAnswer({
        session,
        question: currentQuestion,
        history,
        transcript: speechCapture.transcript
      });
      const nextHistory = [
        ...history,
        response.turn
      ];

      setSession(response.session);
      setHistory(nextHistory);
      setSuggestedAnswer(null);
      setSpeakingTips([]);
      persistInterview(response.session, currentQuestion, null, nextHistory);

      // Prefetch next question in background (fire-and-forget)
      prefetchSessionRef.current = response.session;
      getNextQuestion({
        session: response.session,
        history: nextHistory,
      }).then((nextResponse) => {
        prefetchedNextQuestionRef.current = nextResponse;
      }).catch(() => {
        // Silently fail — user will fetch on demand
        prefetchedNextQuestionRef.current = null;
      });
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setWorkStatus("idle");
    }
  };

  const handleRetryQuestion = (): void => {
    if (session === null || currentQuestion === null) {
      return;
    }

    setSuggestedAnswer(null);
    setSpeakingTips([]);
    setNoticeMessage(null);
    persistInterview(session, currentQuestion, null, history);
  };

  const handleFinishInterview = (): void => {
    if (session === null) {
      return;
    }
    setStage("summary");
    setNoticeMessage(null);
    persistInterview(session, null, null, history);
  };

  const handleNextQuestion = async (): Promise<void> => {
    if (session === null) {
      return;
    }

    setErrorMessage(null);
    setNoticeMessage(null);

    // Invalidate prefetch cache
    const prefetched = prefetchedNextQuestionRef.current;
    const prefetchedSession = prefetchSessionRef.current;
    prefetchedNextQuestionRef.current = null;
    prefetchSessionRef.current = null;

    // Use prefetched result if it matches current session
    if (prefetched !== null && prefetchedSession?.id === session.id) {
      if (prefetched.question === null) {
        setStage("summary");
        setNoticeMessage(null);
        persistInterview(prefetched.session, null, null, history);
        return;
      }

      setSession(prefetched.session);
      setCurrentQuestion(prefetched.question);
      setSuggestedAnswer(null);
      setSpeakingTips([]);
      setNoticeMessage(null);
      persistInterview(prefetched.session, prefetched.question, null, history);
      await playQuestion(prefetched.question.text, prefetched.session.language);
      return;
    }

    // Fallback: fetch on demand
    setWorkStatus("playing");

    try {
      const response = await getNextQuestion({
        session,
        history
      });

      if (response.question === null) {
        setStage("summary");
        setNoticeMessage(null);
        persistInterview(response.session, null, null, history);
        setWorkStatus("idle");
        return;
      }

      setSession(response.session);
      setCurrentQuestion(response.question);
      setSuggestedAnswer(null);
      setSpeakingTips([]);
      setNoticeMessage(null);
      persistInterview(response.session, response.question, null, history);
      await playQuestion(response.question.text, response.session.language);
    } catch (error: unknown) {
      setWorkStatus("idle");
      setErrorMessage(getErrorMessage(error));
    }
  };

  const handleResumeStoredInterview = (): void => {
    if (storedInterview === null) {
      return;
    }

    setSession(storedInterview.session);
    setCurrentQuestion(storedInterview.currentQuestion);
    setHistory([
      ...storedInterview.history
    ]);
    setCandidateName(storedInterview.session.candidateName);
    setLanguage(storedInterview.session.language);
    setYearsOfExperience(storedInterview.session.yearsOfExperience ?? "0-1 years");
    if (isPredefinedRole(storedInterview.session.role)) {
      setSelectedRole(storedInterview.session.role);
      setCustomRole("");
    } else {
      setSelectedRole(customRoleValue);
      setCustomRole(storedInterview.session.role);
    }
    setSuggestedAnswer(null);
    setSpeakingTips([]);
    setNoticeMessage(null);
    setStage(storedInterview.currentQuestion === null ? "summary" : "interview");

    // Clear CV/JD when resuming (they're not part of stored interview)
    setCvAnalysis(null);
    setJdAnalysis(null);
    setCvJdMatch(null);
  };

  const handleResetInterview = (): void => {
    activeSpeechCaptureRef.current = null;
    stopCurrentPlayback();

    // Stop mic stream
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
      setMicStream(null);
    }

    clearStoredInterview();
    setStoredInterview(null);
    setSession(null);
    setCurrentQuestion(null);
    setHistory([]);
    setSuggestedAnswer(null);
    setSpeakingTips([]);
    setErrorMessage(null);
    setNoticeMessage(null);
    setWorkStatus("idle");
    setStage("setup");

    // Clear CV/JD from state + localStorage
    setCvAnalysis(null);
    setJdAnalysis(null);
    setCvJdMatch(null);
    clearLs(LS_CV);
    clearLs(LS_JD);
    clearLs(LS_MATCH);

    // Cleanup Whisper
    whisperRef.current?.terminate();
    whisperRef.current = null;
    audioCaptureRef.current = null;
    setWhisperStatus("idle");
  };

  const playQuestion = async (text: string, nextLanguage: InterviewLanguage): Promise<void> => {
    setErrorMessage(null);
    setNoticeMessage(null);
    setWorkStatus("playing");
    stopCurrentPlayback();

    try {
      await speakText(text, nextLanguage);
      setWorkStatus("idle");
    } catch (error: unknown) {
      stopCurrentPlayback();
      setWorkStatus("idle");
      if (isVoicePlaybackError(error)) {
        setNoticeMessage("Voice playback is unavailable. You can continue by reading the question on screen.");
        return;
      }

      setErrorMessage(getErrorMessage(error));
    }
  };

  return (
    <main className="relative z-10 min-h-screen bg-transparent text-ink">
      <ParticlesBackground />
      <GradientOrbs />
      {stage === "setup" ? (
        <SetupScreen
          candidateName={candidateName}
          customRole={customRole}
          errorMessage={errorMessage}
          language={language}
          selectedRole={selectedRole}
          yearsOfExperience={yearsOfExperience}
          storedInterview={storedInterview}
          cvAnalysis={cvAnalysis}
          jdAnalysis={jdAnalysis}
          cvJdMatch={cvJdMatch}
          isParsingCv={isParsingCv}
          isAnalyzingJd={isAnalyzingJd}
          isMatching={isMatching}
          onCandidateNameChange={setCandidateName}
          onCustomRoleChange={setCustomRole}
          onLanguageChange={setLanguage}
          onProfileSubmit={handleProfileSubmit}
          onResume={handleResumeStoredInterview}
          onCvUpload={handleCvUpload}
          onJdTextChange={handleJdTextChange}
          onAnalyzeJd={(jdText: string) => handleAnalyzeJd(jdText)}
          onMatchCvJd={handleMatchCvJd}
          onSkipCv={handleSkipCv}
          onSkipJd={handleSkipJd}
          onSelectedRoleChange={setSelectedRole}
          onYearsOfExperienceChange={setYearsOfExperience}
        />
      ) : null}

      {stage === "readiness" ? (
        <ReadinessScreen
          errorMessage={errorMessage}
          noticeMessage={noticeMessage}
          workStatus={workStatus}
          onBack={() => {
            setStage("setup");
            setErrorMessage(null);
          }}
          onConfirm={handleConfirmReady}
        />
      ) : null}

      {stage === "interview" && session !== null && currentQuestion !== null ? (
        <InterviewScreen
          canUseInterviewActions={canUseInterviewActions}
          currentQuestion={currentQuestion}
          errorMessage={errorMessage}
          history={history}
          isBusy={isBusy}
          lastTurn={lastTurn}
          session={session}
          noticeMessage={noticeMessage}
          speakingTips={speakingTips}
          suggestedAnswer={suggestedAnswer}
          workStatus={workStatus}
          onFinish={handleFinishInterview}
          onNextQuestion={handleNextQuestion}
          onReplay={handleReplayQuestion}
          onReset={handleResetInterview}
          onRetry={handleRetryQuestion}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          onSuggest={handleSuggestAnswer}
          micStream={micStream}
          whisperStatus={whisperStatus}
        />
      ) : null}

      {stage === "summary" && session !== null ? (
        <SummaryScreen
          history={history}
          session={session}
          onReset={handleResetInterview}
        />
      ) : null}
    </main>
  );
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    return getApiErrorMessage(error);
  }

  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Microphone access was blocked. Please allow microphone access in your browser and try again.";
  }

  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No microphone was found. Please connect a microphone and try again.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
};

const getApiErrorMessage = (error: ApiError): string => {
  if (error.code === "AI_UNAVAILABLE") {
    return "The AI interviewer is unavailable right now. Please try again.";
  }

  if (error.code === "CONFIG_MISSING") {
    return "A required service is not configured. Please check your local setup and restart the app.";
  }

  if (error.code === "RATE_LIMITED") {
    return "The service is temporarily rate limited. Please wait a moment and try again.";
  }

  if (error.code === "INVALID_INPUT") {
    return "Please check your input and try again.";
  }

  return error.message;
};

const isVoicePlaybackError = (error: unknown): boolean => {
  return error instanceof Error && error.message.includes("Text-to-speech");
};

const isPredefinedRole = (role: string): boolean => {
  return predefinedRoles.some((predefinedRole: string): boolean => predefinedRole === role);
};
