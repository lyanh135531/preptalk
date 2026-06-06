import type {
  InterviewLanguage,
  InterviewSession,
  InterviewTurn,
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
  getNextQuestion
} from "./api/client";
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
import { SetupScreen } from "./components/SetupScreen";
import { ReadinessScreen } from "./components/ReadinessScreen";
import { InterviewScreen } from "./components/InterviewScreen";
import { SummaryScreen } from "./components/SummaryScreen";

type AppStage = "setup" | "readiness" | "interview" | "summary";
type WorkStatus = "idle" | "starting" | "playing" | "suggesting" | "recording" | "submitting";

const customRoleValue = "__custom_role__";
const defaultRole = "Backend Engineer .NET";

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
  const activeSpeechCaptureRef = useRef<ActiveSpeechCapture | null>(null);

  const stopCurrentPlayback = (): void => {
    stopSpeech();
  };

  useEffect((): (() => void) => {
    setStoredInterview(loadStoredInterview());

    return (): void => {
      stopSpeech();
    };
  }, []);

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
        yearsOfExperience
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
      activeSpeechCaptureRef.current = startSpeechCapture(session.language);
      setWorkStatus("recording");
    } catch (error: unknown) {
      setWorkStatus("idle");
      setErrorMessage(getErrorMessage(error));
    }
  };

  const handleStopRecording = async (): Promise<void> => {
    if (session === null || currentQuestion === null || activeSpeechCaptureRef.current === null) {
      return;
    }

    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      const speechCapture = await activeSpeechCaptureRef.current.stop();
      activeSpeechCaptureRef.current = null;
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
  };

  const handleResetInterview = (): void => {
    activeSpeechCaptureRef.current = null;
    stopCurrentPlayback();
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
    <main className="min-h-screen bg-surface text-ink">
      {stage === "setup" ? (
        <SetupScreen
          candidateName={candidateName}
          customRole={customRole}
          errorMessage={errorMessage}
          language={language}
          selectedRole={selectedRole}
          yearsOfExperience={yearsOfExperience}
          storedInterview={storedInterview}
          onCandidateNameChange={setCandidateName}
          onCustomRoleChange={setCustomRole}
          onLanguageChange={setLanguage}
          onProfileSubmit={handleProfileSubmit}
          onResume={handleResumeStoredInterview}
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
