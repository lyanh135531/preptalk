import type {
  FeedbackSpanType,
  InterviewLanguage,
  InterviewSession,
  InterviewTurn,
  Question,
  Score,
  StoredInterview
} from "@preptalk/shared";
import { predefinedRoles } from "@preptalk/shared";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  ChevronRight,
  CircleStop,
  Headphones,
  Lightbulb,
  Mic,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
  Volume2
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ApiError, getHealthStatus } from "./api/client";
import {
  startInterview,
  submitAnswer,
  suggestAnswer
} from "./api/client";
import type { ActiveSpeechCapture } from "./lib/audio";
import {
  ensureMicrophoneAccess,
  ensureSpeechRecognitionSupport,
  ensureSpeechSynthesisSupport,
  speakText,
  startSpeechCapture,
  stopSpeech
} from "./lib/audio";
import { buildInterviewSummary } from "./lib/summary";
import {
  clearStoredInterview,
  loadStoredInterview,
  saveStoredInterview
} from "./lib/storage";

type AppStage = "setup" | "readiness" | "interview" | "summary";
type WorkStatus = "idle" | "starting" | "playing" | "suggesting" | "recording" | "submitting";

const customRoleValue = "__custom_role__";
const defaultRole = "Backend Engineer .NET";

const languageLabels: Record<InterviewLanguage, string> = {
  vi: "Vietnamese",
  en: "English"
};

const scoreLabels: Record<keyof Score, string> = {
  communication: "Communication",
  roleRelevance: "Role fit",
  structure: "Structure",
  languageAccuracy: "Language",
  confidence: "Confidence"
};

const spanClassByType: Record<FeedbackSpanType, string> = {
  grammar: "bg-rose-500/20 text-rose-100 ring-1 ring-rose-400/35",
  spelling: "bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/35",
  word_choice: "bg-orange-500/20 text-orange-100 ring-1 ring-orange-400/35",
  clarity: "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/35",
  content_gap: "bg-violet-500/20 text-violet-100 ring-1 ring-violet-400/35",
  strong_point: "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/35",
  neutral: "text-slate-200"
};

export const App = () => {
  const [stage, setStage] = useState<AppStage>("setup");
  const [workStatus, setWorkStatus] = useState<WorkStatus>("idle");
  const [candidateName, setCandidateName] = useState<string>("");
  const [language, setLanguage] = useState<InterviewLanguage>("en");
  const [selectedRole, setSelectedRole] = useState<string>(defaultRole);
  const [customRole, setCustomRole] = useState<string>("");
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [pendingNextQuestion, setPendingNextQuestion] = useState<Question | null>(null);
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
      ensureSpeechSynthesisSupport();
      await ensureMicrophoneAccess();

      const healthStatus = await getHealthStatus();

      if (!healthStatus.openRouterConfigured) {
        throw new ApiError("The AI interviewer is not configured. Please check your local setup and restart the app.", "CONFIG_MISSING", null);
      }

      const response = await startInterview({
        candidateName: candidateName.trim(),
        language,
        role: resolvedRole
      });

      setSession(response.session);
      setCurrentQuestion(response.question);
      setPendingNextQuestion(null);
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
      setPendingNextQuestion(response.nextQuestion);
      setSuggestedAnswer(null);
      setSpeakingTips([]);
      persistInterview(response.session, currentQuestion, response.nextQuestion, nextHistory);
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

    setPendingNextQuestion(null);
    setSuggestedAnswer(null);
    setSpeakingTips([]);
    setNoticeMessage(null);
    persistInterview(session, currentQuestion, null, history);
  };

  const handleNextQuestion = async (): Promise<void> => {
    if (session === null) {
      return;
    }

    if (pendingNextQuestion === null) {
      setStage("summary");
      setNoticeMessage(null);
      persistInterview(session, null, null, history);
      return;
    }

    setCurrentQuestion(pendingNextQuestion);
    setPendingNextQuestion(null);
    setSuggestedAnswer(null);
    setSpeakingTips([]);
    setNoticeMessage(null);
    persistInterview(session, pendingNextQuestion, null, history);
    await playQuestion(pendingNextQuestion.text, session.language);
  };

  const handleResumeStoredInterview = (): void => {
    if (storedInterview === null) {
      return;
    }

    setSession(storedInterview.session);
    setCurrentQuestion(storedInterview.currentQuestion);
    setPendingNextQuestion(storedInterview.pendingNextQuestion);
    setHistory([
      ...storedInterview.history
    ]);
    setCandidateName(storedInterview.session.candidateName);
    setLanguage(storedInterview.session.language);
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
    setPendingNextQuestion(null);
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
          storedInterview={storedInterview}
          onCandidateNameChange={setCandidateName}
          onCustomRoleChange={setCustomRole}
          onLanguageChange={setLanguage}
          onProfileSubmit={handleProfileSubmit}
          onResume={handleResumeStoredInterview}
          onSelectedRoleChange={setSelectedRole}
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
          pendingNextQuestion={pendingNextQuestion}
          session={session}
          noticeMessage={noticeMessage}
          speakingTips={speakingTips}
          suggestedAnswer={suggestedAnswer}
          workStatus={workStatus}
          onFinish={handleNextQuestion}
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

type SetupScreenProps = {
  readonly candidateName: string;
  readonly customRole: string;
  readonly errorMessage: string | null;
  readonly language: InterviewLanguage;
  readonly selectedRole: string;
  readonly storedInterview: StoredInterview | null;
  readonly onCandidateNameChange: (value: string) => void;
  readonly onCustomRoleChange: (value: string) => void;
  readonly onLanguageChange: (value: InterviewLanguage) => void;
  readonly onProfileSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onResume: () => void;
  readonly onSelectedRoleChange: (value: string) => void;
};

const SetupScreen = (props: SetupScreenProps) => (
  <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
    <header className="flex items-center justify-between border-b border-line pb-5">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-cyan-650 text-white">
          <Brain size={22} aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">PrepTalk</p>
          <h1 className="text-xl font-semibold text-ink sm:text-2xl">AI Interview Practice</h1>
        </div>
      </div>
      <div className="hidden items-center gap-2 text-sm text-slate-300 sm:flex">
        <Sparkles size={16} aria-hidden="true" />
        <span>Realistic voice practice</span>
      </div>
    </header>

    <div className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-6">
        <div className="max-w-xl space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Practice interview</p>
          <h2 className="text-4xl font-semibold leading-tight text-ink sm:text-5xl">
            Practice interviews with live feedback.
          </h2>
          <p className="text-lg leading-8 text-slate-300">
            Choose a role, answer by voice, and improve after every response.
          </p>
        </div>

        <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
          <Metric label="Voice" value="Listen and speak" />
          <Metric label="Feedback" value="After each answer" />
          <Metric label="Review" value="End summary" />
        </div>
      </div>

      <form className="rounded-lg border border-line bg-panel p-5 shadow-soft sm:p-6" onSubmit={props.onProfileSubmit}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold text-ink">Start practice</h3>
            <p className="mt-1 text-sm text-slate-300">Set up your interview session.</p>
          </div>
          <Headphones className="text-cyan-300" size={28} aria-hidden="true" />
        </div>

        {props.storedInterview !== null ? (
          <div className="mb-5 rounded-lg border border-cyan-400/30 bg-cyan-950/35 p-4">
            <p className="text-sm font-semibold text-cyan-100">You have an unfinished practice session</p>
            <p className="mt-1 text-sm text-cyan-200">
              {props.storedInterview.session.candidateName} · {props.storedInterview.session.role}
            </p>
            <button
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-cyan-650 px-3 py-2 text-sm font-semibold text-white"
              type="button"
              onClick={props.onResume}
            >
              Resume
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-200">Your name</span>
            <input
              className="mt-2 w-full rounded-lg border border-line bg-slate-950/70 px-4 py-3 text-base text-ink shadow-sm placeholder:text-slate-500"
              placeholder="Example: Alex Nguyen"
              value={props.candidateName}
              onChange={(event) => props.onCandidateNameChange(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-200">Interview language</span>
            <select
              className="mt-2 w-full rounded-lg border border-line bg-slate-950/70 px-4 py-3 text-base text-ink shadow-sm"
              value={props.language}
              onChange={(event) => props.onLanguageChange(event.target.value as InterviewLanguage)}
            >
              <option value="en">English</option>
              <option value="vi">Vietnamese</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-200">Role or industry</span>
            <select
              className="mt-2 w-full rounded-lg border border-line bg-slate-950/70 px-4 py-3 text-base text-ink shadow-sm"
              value={props.selectedRole}
              onChange={(event) => props.onSelectedRoleChange(event.target.value)}
            >
              {predefinedRoles.map((role: string) => (
                <option key={role} value={role}>{role}</option>
              ))}
              <option value={customRoleValue}>Enter another role</option>
            </select>
          </label>

          {props.selectedRole === customRoleValue ? (
            <label className="block">
              <span className="text-sm font-medium text-slate-200">Custom role</span>
              <input
                className="mt-2 w-full rounded-lg border border-line bg-slate-950/70 px-4 py-3 text-base text-ink shadow-sm placeholder:text-slate-500"
                placeholder="Example: Sales Operations Manager"
                value={props.customRole}
                onChange={(event) => props.onCustomRoleChange(event.target.value)}
              />
            </label>
          ) : null}
        </div>

        <ErrorBanner message={props.errorMessage} />

        <button className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-650 px-5 py-3 text-base font-semibold text-white transition hover:bg-cyan-500" type="submit">
          Start interview
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </form>
    </div>
  </section>
);

type ReadinessScreenProps = {
  readonly errorMessage: string | null;
  readonly noticeMessage: string | null;
  readonly workStatus: WorkStatus;
  readonly onBack: () => void;
  readonly onConfirm: () => Promise<void>;
};

const ReadinessScreen = (props: ReadinessScreenProps) => (
  <section className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-8">
    <div className="w-full rounded-lg border border-line bg-panel p-6 shadow-soft sm:p-8">
      <div className="flex items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-lg bg-cyan-650 text-white">
          <Headphones size={26} aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Ready check</p>
          <h2 className="text-2xl font-semibold text-ink">Get ready to listen and speak</h2>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <ReadinessItem title="Headphones" text="Use headphones for the best voice experience." />
        <ReadinessItem title="Microphone" text="Allow microphone access when prompted." />
        <ReadinessItem title="Browser" text="Microsoft Edge is recommended for voice playback." />
      </div>

      <ErrorBanner message={props.errorMessage} />
      <NoticeBanner message={props.noticeMessage} />

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button className="rounded-lg border border-line px-5 py-3 font-semibold text-slate-200 hover:bg-slate-800" type="button" onClick={props.onBack}>
          Back
        </button>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-650 px-5 py-3 font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-600"
          type="button"
          disabled={props.workStatus === "starting"}
          onClick={props.onConfirm}
        >
          {props.workStatus === "starting" ? "Preparing interview..." : "I am ready"}
          <CheckCircle2 size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  </section>
);

type InterviewScreenProps = {
  readonly canUseInterviewActions: boolean;
  readonly currentQuestion: Question;
  readonly errorMessage: string | null;
  readonly history: readonly InterviewTurn[];
  readonly isBusy: boolean;
  readonly lastTurn: InterviewTurn | null | undefined;
  readonly pendingNextQuestion: Question | null;
  readonly session: InterviewSession;
  readonly noticeMessage: string | null;
  readonly speakingTips: readonly string[];
  readonly suggestedAnswer: string | null;
  readonly workStatus: WorkStatus;
  readonly onFinish: () => Promise<void>;
  readonly onNextQuestion: () => Promise<void>;
  readonly onReplay: () => Promise<void>;
  readonly onReset: () => void;
  readonly onRetry: () => void;
  readonly onStartRecording: () => void;
  readonly onStopRecording: () => Promise<void>;
  readonly onSuggest: () => Promise<void>;
};

const InterviewScreen = (props: InterviewScreenProps) => (
  <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
    <header className="flex flex-col gap-4 border-b border-line pb-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-cyan-650 text-white">
          <Brain size={22} aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Live interview</p>
          <h1 className="text-xl font-semibold text-ink">{props.session.role}</h1>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge>{props.session.candidateName}</Badge>
        <Badge>{languageLabels[props.session.language]}</Badge>
        <Badge>Question {props.session.currentQuestionNumber}/{props.session.maxQuestions}</Badge>
        <button className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 font-semibold text-slate-200 hover:bg-slate-800" type="button" onClick={props.onReset}>
          <Trash2 size={16} aria-hidden="true" />
          Reset
        </button>
      </div>
    </header>

    <div className="grid flex-1 gap-5 py-5 lg:grid-cols-[0.8fr_1.2fr]">
      <aside className="space-y-4">
        <section className="rounded-lg border border-line bg-panel p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-ink">Current question</h2>
            <button
              className="inline-flex size-10 items-center justify-center rounded-lg border border-line text-cyan-300 hover:bg-cyan-950/35 disabled:cursor-not-allowed disabled:text-slate-600"
              type="button"
              title="Replay question"
              disabled={props.isBusy}
              onClick={props.onReplay}
            >
              <Volume2 size={19} aria-hidden="true" />
            </button>
          </div>
          <p className="text-xl font-semibold leading-8 text-ink">{props.currentQuestion.text}</p>
          <p className="mt-4 text-sm text-slate-400">{props.currentQuestion.category} · {props.currentQuestion.rationale}</p>
        </section>

        <section className="rounded-lg border border-line bg-panel p-5">
          <h2 className="text-lg font-semibold text-ink">Answer history</h2>
          <div className="mt-4 space-y-3">
            {props.history.length === 0 ? (
              <p className="text-sm text-slate-400">No answers yet.</p>
            ) : props.history.map((turn: InterviewTurn, index: number) => (
              <div className="rounded-lg border border-line p-3" key={turn.id}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Attempt {index + 1}</p>
                <p className="mt-1 line-clamp-2 text-sm font-medium text-ink">{turn.question.text}</p>
              </div>
            ))}
          </div>
        </section>
      </aside>

      <section className="space-y-4">
        <div className="rounded-lg border border-line bg-panel p-5 shadow-soft">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">Answer area</h2>
              <p className="mt-1 text-sm text-slate-400">{statusText(props.workStatus)}</p>
            </div>
            <div className="hidden gap-2 md:flex">
          <InterviewActions
            canUseInterviewActions={props.canUseInterviewActions}
            canAdvance={props.lastTurn !== null && props.lastTurn !== undefined}
            isBusy={props.isBusy}
                pendingNextQuestion={props.pendingNextQuestion}
                workStatus={props.workStatus}
                onFinish={props.onFinish}
                onNextQuestion={props.onNextQuestion}
                onRetry={props.onRetry}
                onStartRecording={props.onStartRecording}
                onStopRecording={props.onStopRecording}
                onSuggest={props.onSuggest}
              />
            </div>
          </div>

          <ErrorBanner message={props.errorMessage} />
          <NoticeBanner message={props.noticeMessage} />

          {props.suggestedAnswer !== null ? (
            <div className="mt-5 rounded-lg border border-cyan-400/30 bg-cyan-950/35 p-4">
              <div className="flex items-center gap-2 text-cyan-100">
                <Lightbulb size={18} aria-hidden="true" />
                <h3 className="font-semibold">Suggested answer</h3>
              </div>
              <p className="mt-3 whitespace-pre-wrap leading-7 text-cyan-100">{props.suggestedAnswer}</p>
              {props.speakingTips.length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm text-cyan-200">
                  {props.speakingTips.map((tip: string) => (
                    <li key={tip}>- {tip}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        {props.lastTurn !== null && props.lastTurn !== undefined ? (
          <FeedbackPanel turn={props.lastTurn} />
        ) : (
          <div className="rounded-lg border border-dashed border-line bg-panel p-8 text-center">
            <Mic className="mx-auto text-slate-500" size={34} aria-hidden="true" />
            <h3 className="mt-3 text-lg font-semibold text-ink">Ready for your answer</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Speak naturally, then review the feedback.
            </p>
          </div>
        )}
      </section>
    </div>

    <div className="sticky bottom-0 z-10 border-t border-line bg-surface/95 py-3 backdrop-blur md:hidden">
      <InterviewActions
        canUseInterviewActions={props.canUseInterviewActions}
        canAdvance={props.lastTurn !== null && props.lastTurn !== undefined}
        isBusy={props.isBusy}
        pendingNextQuestion={props.pendingNextQuestion}
        workStatus={props.workStatus}
        onFinish={props.onFinish}
        onNextQuestion={props.onNextQuestion}
        onRetry={props.onRetry}
        onStartRecording={props.onStartRecording}
        onStopRecording={props.onStopRecording}
        onSuggest={props.onSuggest}
      />
    </div>
  </section>
);

type InterviewActionsProps = {
  readonly canUseInterviewActions: boolean;
  readonly canAdvance: boolean;
  readonly isBusy: boolean;
  readonly pendingNextQuestion: Question | null;
  readonly workStatus: WorkStatus;
  readonly onFinish: () => Promise<void>;
  readonly onNextQuestion: () => Promise<void>;
  readonly onRetry: () => void;
  readonly onStartRecording: () => void;
  readonly onStopRecording: () => Promise<void>;
  readonly onSuggest: () => Promise<void>;
};

const InterviewActions = (props: InterviewActionsProps) => (
  <div className="grid grid-cols-2 gap-2 sm:flex">
    <button
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-slate-900 px-3 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-600"
      type="button"
      disabled={!props.canUseInterviewActions || props.isBusy}
      onClick={props.onSuggest}
    >
      <Lightbulb size={17} aria-hidden="true" />
      Suggest
    </button>
    {props.workStatus === "recording" ? (
      <button
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-3 text-sm font-semibold text-white hover:bg-rose-500"
        type="button"
        onClick={props.onStopRecording}
      >
        <CircleStop size={17} aria-hidden="true" />
        Stop
      </button>
    ) : (
      <button
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-650 px-3 py-3 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-600"
        type="button"
        disabled={!props.canUseInterviewActions || props.isBusy}
        onClick={props.onStartRecording}
      >
        <Mic size={17} aria-hidden="true" />
        Answer
      </button>
    )}
    <button
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-slate-900 px-3 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-600"
      type="button"
      disabled={!props.canUseInterviewActions || props.isBusy || props.workStatus === "recording"}
      onClick={props.onRetry}
    >
      <RotateCcw size={17} aria-hidden="true" />
      Retry
    </button>
    <button
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-650 px-3 py-3 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-600"
      type="button"
      disabled={!props.canUseInterviewActions || !props.canAdvance || props.isBusy || props.workStatus === "recording"}
      onClick={props.pendingNextQuestion === null ? props.onFinish : props.onNextQuestion}
    >
      {props.pendingNextQuestion === null ? "Finish" : "Next"}
      <ArrowRight size={17} aria-hidden="true" />
    </button>
  </div>
);

type FeedbackPanelProps = {
  readonly turn: InterviewTurn;
};

const FeedbackPanel = (props: FeedbackPanelProps) => (
  <div className="space-y-4">
    <section className="rounded-lg border border-line bg-panel p-5 shadow-soft">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">What you said</h3>
          <p className="mt-3 whitespace-pre-wrap rounded-lg border border-line bg-slate-950/70 p-4 leading-7 text-slate-200">
            {props.turn.transcript}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Improved answer</h3>
          <div className="mt-3 rounded-lg border border-line bg-slate-950/70 p-4 leading-8">
            {props.turn.feedback.correctionSpans.map((span, index) => (
              <span className={`mx-0.5 rounded px-1 py-0.5 ${spanClassByType[span.type]}`} key={`${span.text}-${String(index)}`}>
                {span.text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>

    <section className="rounded-lg border border-line bg-panel p-5">
      <h3 className="text-lg font-semibold text-ink">Score</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {scoreEntries(props.turn.feedback.score).map(([key, value]) => (
          <ScoreMeter key={key} label={scoreLabels[key]} value={value} />
        ))}
      </div>
    </section>

    <section className="grid gap-4 lg:grid-cols-3">
      <FeedbackList title="Language" items={props.turn.feedback.grammarFeedback} />
      <FeedbackList title="Content" items={props.turn.feedback.contentFeedback} />
      <FeedbackList title="Pronunciation hints" items={props.turn.feedback.pronunciationHints} />
    </section>

    <section className="grid gap-4 md:grid-cols-2">
      <FeedbackList title="Strengths" items={props.turn.feedback.strengths} />
      <FeedbackList title="Practice next" items={props.turn.feedback.improvements} />
    </section>

    {props.turn.feedback.issues.length > 0 ? (
      <section className="rounded-lg border border-line bg-panel p-5">
        <h3 className="text-lg font-semibold text-ink">Detailed corrections</h3>
        <div className="mt-4 space-y-3">
          {props.turn.feedback.issues.map((issue) => (
            <div className="rounded-lg border border-line p-4" key={`${issue.type}-${issue.originalText}-${issue.suggestedText}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{issue.type.replace("_", " ")}</Badge>
                <Badge>{issue.severity}</Badge>
              </div>
              <p className="mt-3 text-sm text-slate-300">
                <span className="font-semibold text-rose-300">{issue.originalText}</span>
                <span>{" -> "}</span>
                <span className="font-semibold text-emerald-300">{issue.suggestedText}</span>
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{issue.explanation}</p>
            </div>
          ))}
        </div>
      </section>
    ) : null}
  </div>
);

type SummaryScreenProps = {
  readonly history: readonly InterviewTurn[];
  readonly session: InterviewSession;
  readonly onReset: () => void;
};

const SummaryScreen = (props: SummaryScreenProps) => {
  const summary = buildInterviewSummary(props.history);
  const hasAnswers = props.history.length > 0;

  return (
    <section className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Session summary</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">{props.session.role}</h1>
          <p className="mt-2 text-slate-400">{props.session.candidateName} · {languageLabels[props.session.language]}</p>
        </div>
        <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-650 px-5 py-3 font-semibold text-white hover:bg-cyan-500" type="button" onClick={props.onReset}>
          New practice
          <Play size={17} aria-hidden="true" />
        </button>
      </header>

      {hasAnswers ? (
        <>
          <div className="grid gap-5 py-6 lg:grid-cols-[0.8fr_1.2fr]">
            <section className="rounded-lg border border-line bg-panel p-5 shadow-soft">
              <h2 className="text-lg font-semibold text-ink">Average score</h2>
              <div className="mt-4 space-y-3">
                {scoreEntries(summary.averageScore).map(([key, value]) => (
                  <ScoreMeter key={key} label={scoreLabels[key]} value={value} />
                ))}
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <FeedbackList title="Strengths" items={summary.strengths} />
              <FeedbackList title="Practice next" items={summary.improvements} />
            </section>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Interview log</h2>
            {props.history.map((turn: InterviewTurn, index: number) => (
              <div className="rounded-lg border border-line bg-panel p-4" key={turn.id}>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Question {index + 1}</p>
                <h3 className="mt-2 font-semibold text-ink">{turn.question.text}</h3>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Transcript</p>
                    <p className="mt-2 whitespace-pre-wrap rounded-lg border border-line bg-slate-950/70 p-3 text-sm leading-6 text-slate-300">{turn.transcript}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Improved answer</p>
                    <p className="mt-2 whitespace-pre-wrap rounded-lg border border-line bg-slate-950/70 p-3 text-sm leading-6 text-slate-300">{turn.correctedAnswer}</p>
                  </div>
                </div>
              </div>
            ))}
          </section>
        </>
      ) : (
        <section className="mt-6 rounded-lg border border-line bg-panel p-8 text-center">
          <h2 className="text-xl font-semibold text-ink">No answers yet</h2>
          <p className="mt-2 text-sm text-slate-400">Start a new practice session when you are ready.</p>
        </section>
      )}
    </section>
  );
};

type FeedbackListProps = {
  readonly title: string;
  readonly items: readonly string[];
};

const FeedbackList = (props: FeedbackListProps) => (
  <section className="rounded-lg border border-line bg-panel p-5">
    <h3 className="text-lg font-semibold text-ink">{props.title}</h3>
    {props.items.length > 0 ? (
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
        {props.items.map((item: string) => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    ) : (
      <p className="mt-3 text-sm text-slate-400">No feedback yet.</p>
    )}
  </section>
);

type ScoreMeterProps = {
  readonly label: string;
  readonly value: number;
};

const ScoreMeter = (props: ScoreMeterProps) => (
  <div>
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="font-medium text-slate-300">{props.label}</span>
      <span className="font-semibold text-ink">{props.value}</span>
    </div>
    <div className="mt-2 h-2 rounded-full bg-slate-800">
      <div className="h-2 rounded-full bg-cyan-650" style={{ width: `${String(props.value)}%` }} />
    </div>
  </div>
);

type MetricProps = {
  readonly label: string;
  readonly value: string;
};

const Metric = (props: MetricProps) => (
  <div className="rounded-lg border border-line bg-panel p-4">
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{props.label}</p>
    <p className="mt-1 text-lg font-semibold text-ink">{props.value}</p>
  </div>
);

type ReadinessItemProps = {
  readonly title: string;
  readonly text: string;
};

const ReadinessItem = (props: ReadinessItemProps) => (
  <div className="rounded-lg border border-line bg-slate-950/60 p-4">
    <p className="font-semibold text-ink">{props.title}</p>
    <p className="mt-2 text-sm leading-6 text-slate-400">{props.text}</p>
  </div>
);

type BadgeProps = {
  readonly children: ReactNode;
};

const Badge = (props: BadgeProps) => (
  <span className="rounded-lg border border-line bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-200">
    {props.children}
  </span>
);

type ErrorBannerProps = {
  readonly message: string | null;
};

const ErrorBanner = (props: ErrorBannerProps) => {
  if (props.message === null) {
    return null;
  }

  return (
    <div className="mt-4 rounded-lg border border-rose-400/30 bg-rose-950/35 px-4 py-3 text-sm leading-6 text-rose-100">
      {props.message}
    </div>
  );
};

type NoticeBannerProps = {
  readonly message: string | null;
};

const NoticeBanner = (props: NoticeBannerProps) => {
  if (props.message === null) {
    return null;
  }

  return (
    <div className="mt-4 rounded-lg border border-cyan-400/30 bg-cyan-950/35 px-4 py-3 text-sm leading-6 text-cyan-100">
      {props.message}
    </div>
  );
};

const scoreEntries = (score: Score): Array<[keyof Score, number]> => [
  [
    "communication",
    score.communication
  ],
  [
    "roleRelevance",
    score.roleRelevance
  ],
  [
    "structure",
    score.structure
  ],
  [
    "languageAccuracy",
    score.languageAccuracy
  ],
  [
    "confidence",
    score.confidence
  ]
];

const statusText = (status: WorkStatus): string => {
  if (status === "starting") {
    return "AI is preparing your interview.";
  }

  if (status === "playing") {
    return "Reading the question.";
  }

  if (status === "suggesting") {
    return "Preparing a suggested answer.";
  }

  if (status === "recording") {
    return "Listening. Speak naturally, then press Stop.";
  }

  if (status === "submitting") {
    return "Reviewing and analyzing your answer.";
  }

  return "Ready.";
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
