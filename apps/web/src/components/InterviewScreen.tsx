import { useState } from "react";
import type { ReactNode } from "react";
import type { InterviewLanguage, InterviewSession, InterviewTurn, Question } from "@preptalk/shared";
import {
  ArrowRight, Award, Brain, ChevronDown, ChevronUp, CircleStop, Lightbulb,
  Mic, RotateCcw, Volume2
} from "lucide-react";
import { AudioVisualizer } from "./AudioVisualizer";
import { FeedbackPanel } from "./FeedbackPanel";
import { FeedbackSkeleton } from "./Skeleton";

type WorkStatus = "idle" | "starting" | "playing" | "suggesting" | "recording" | "submitting";

type InterviewScreenProps = {
  readonly canUseInterviewActions: boolean;
  readonly currentQuestion: Question;
  readonly errorMessage: string | null;
  readonly history: readonly InterviewTurn[];
  readonly isBusy: boolean;
  readonly lastTurn: InterviewTurn | null | undefined;
  readonly session: InterviewSession;
  readonly noticeMessage: string | null;
  readonly speakingTips: readonly string[];
  readonly suggestedAnswer: string | null;
  readonly workStatus: WorkStatus;
  readonly onFinish: () => void;
  readonly onNextQuestion: () => Promise<void>;
  readonly onReplay: () => Promise<void>;
  readonly onReset: () => void;
  readonly onRetry: () => void;
  readonly onStartRecording: () => void;
  readonly onStopRecording: () => Promise<void>;
  readonly onSuggest: () => Promise<void>;
  readonly micStream: MediaStream | null;
};

const languageLabels: Record<InterviewLanguage, string> = {
  vi: "Vietnamese",
  en: "English"
};

export const InterviewScreen = (props: InterviewScreenProps) => {
  const currentQNum = props.session.currentQuestionNumber;
  const isRecording = props.workStatus === "recording";
  const isSubmitting = props.workStatus === "submitting";
  const isSuggesting = props.workStatus === "suggesting";
  const isPlaying = props.workStatus === "playing";
  const [rationaleOpen, setRationaleOpen] = useState(false);
  const [expandedTurnId, setExpandedTurnId] = useState<string | null>(null);

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8 pb-40 md:pb-5 animate-fade-in">
      {/* Top Banner Header */}
      <header className="flex flex-col gap-4 border-b border-line pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-650 to-indigo-600 text-white">
            <Brain size={22} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">Live Interview Room</p>
            <h1 className="text-lg font-bold font-display text-ink truncate">{props.session.role}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge>{props.session.candidateName}</Badge>
          <Badge>{languageLabels[props.session.language]}</Badge>
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-slate-900/50 px-3 py-2 font-semibold text-slate-300 hover:bg-cyan-950/20 hover:text-cyan-300 hover:border-cyan-900/50 active:scale-[0.97] transition-all"
            type="button"
            onClick={props.onFinish}
          >
            <Award size={14} aria-hidden="true" className="text-cyan-400" />
            Finish Session
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[0.85fr_1.15fr]">

        {/* Left Side: Current Question & History */}
        <aside className="space-y-4 order-2 lg:order-1">
          {/* Question card: sticky on mobile, normal on desktop */}
          <section className="lg:rounded-2xl lg:border lg:border-line lg:bg-panel/65 lg:p-5 lg:shadow-soft lg:backdrop-blur-md lg:glass-panel
            mobile-question-sticky">
            <div className="flex items-center justify-between gap-4 mb-3 lg:mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded bg-cyan-950/60 border border-cyan-800/40 px-2.5 py-1 text-xs font-bold text-cyan-300 uppercase tracking-wide">
                  Question {currentQNum}
                </span>
                <CategoryBadge category={props.currentQuestion.category} />
              </div>
              <button
                className="inline-flex size-11 items-center justify-center rounded-xl border border-line text-cyan-300 bg-slate-900/50 hover:bg-cyan-950/40 hover:border-cyan-500/30 transition-all disabled:cursor-not-allowed disabled:text-slate-600 disabled:bg-transparent"
                type="button"
                title="Replay audio of question"
                disabled={props.isBusy}
                onClick={props.onReplay}
                aria-label="Replay question audio"
              >
                <Volume2 size={20} aria-hidden="true" />
              </button>
            </div>
            <p className="text-base sm:text-xl font-bold leading-7 sm:leading-9 text-ink font-display">{props.currentQuestion.text}</p>

            {/* Rationale: collapsible on mobile, always visible on desktop */}
            <button
              className="md:hidden mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition"
              type="button"
              onClick={() => setRationaleOpen(!rationaleOpen)}
              aria-expanded={rationaleOpen}
            >
              {rationaleOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {rationaleOpen ? "Hide rationale" : "Why this question?"}
            </button>

            {rationaleOpen ? (
              <div className="mt-3 md:mt-5 border-t border-line/50 pt-3 md:pt-4 flex flex-col gap-2 text-xs text-slate-400 animate-fade-in-up">
                <span className="font-semibold text-slate-300">Rationale for this topic:</span>
                <p className="leading-5">{props.currentQuestion.rationale}</p>
              </div>
            ) : (
              <div className="mt-5 border-t border-line/50 pt-4 flex flex-col gap-2 text-xs text-slate-400 hidden md:flex">
                <span className="font-semibold text-slate-300">Rationale for this topic:</span>
                <p className="leading-5">{props.currentQuestion.rationale}</p>
              </div>
            )}
          </section>

          {/* History log */}
          <section className="rounded-2xl border border-line bg-panel/65 p-5 backdrop-blur-md glass-panel">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Turn Log</h2>
            <div className="mt-4 space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {props.history.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Conversations will appear here once you start answering.</p>
              ) : props.history.map((turn, index: number) => {
                const isExpanded = expandedTurnId === turn.id;
                return (
                  <div
                    className="rounded-xl border border-line bg-slate-950/30 transition-all duration-200"
                    key={turn.id}
                  >
                    <button
                      className="w-full p-3 flex gap-3 items-center justify-between text-left hover:bg-slate-900/30 transition rounded-xl"
                      type="button"
                      onClick={() => setExpandedTurnId(isExpanded ? null : turn.id)}
                      aria-expanded={isExpanded}
                    >
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Q{index + 1} Answered</p>
                        <p className="mt-1 line-clamp-1 text-xs font-medium text-slate-300">{turn.question.text}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                          {turn.feedback.score.communication} pts
                        </span>
                        <ChevronDown
                          size={14}
                          className={`text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                          aria-hidden="true"
                        />
                      </div>
                    </button>

                    {isExpanded ? (
                      <div className="px-3 pb-3 space-y-3 animate-fade-in-up">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Your Transcript</p>
                          <p className="text-xs leading-5 text-slate-300 whitespace-pre-wrap">{turn.transcript}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Improved Answer</p>
                          <p className="text-xs leading-5 text-cyan-200 whitespace-pre-wrap">{turn.correctedAnswer}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(turn.feedback.score).map(([key, value]) => (
                            <span key={key} className="rounded bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                              {key}: {String(value)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        </aside>

        {/* Right Side: Answer Capture & Feedback Area */}
        <section className="space-y-4 order-1 lg:order-2">

          {/* Action Pad — desktop only */}
          <div className="rounded-2xl border border-line bg-panel/65 p-5 shadow-soft backdrop-blur-md glass-panel">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-bold text-ink">Speech Recorder</h2>
                <p className="mt-0.5 text-xs text-slate-400" role="status" aria-live="polite">{statusText(props.workStatus)}</p>
              </div>
              <div className="hidden gap-2 md:flex">
                <DesktopActions
                  canUse={props.canUseInterviewActions}
                  isBusy={props.isBusy}
                  isRecording={isRecording}
                  isSubmitting={isSubmitting}
                  isSuggesting={isSuggesting}
                  isPlaying={isPlaying}
                  hasLastTurn={props.lastTurn !== null && props.lastTurn !== undefined}
                  onSuggest={props.onSuggest}
                  onStartRecording={props.onStartRecording}
                  onStopRecording={props.onStopRecording}
                  onRetry={props.onRetry}
                  onNextQuestion={props.onNextQuestion}
                />
              </div>
            </div>

            {props.errorMessage !== null ? (
              <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-950/20 px-4 py-3 text-xs leading-6 text-rose-300" role="alert">
                {props.errorMessage}
              </div>
            ) : null}

            {props.noticeMessage !== null ? (
              <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-950/20 px-4 py-3 text-xs leading-6 text-cyan-300" role="status">
                {props.noticeMessage}
              </div>
            ) : null}

            {/* Audio Waveform active visualization */}
            {isRecording && (
              <div className="mt-4">
                <AudioVisualizer stream={props.micStream} />
              </div>
            )}

            {/* Suggested answers */}
            {props.suggestedAnswer !== null ? (
              <div className="mt-5 rounded-xl border border-cyan-400/20 bg-cyan-950/30 p-4 transition-all duration-300">
                <div className="flex items-center gap-2 text-cyan-300 mb-2">
                  <Lightbulb size={16} aria-hidden="true" />
                  <h3 className="text-sm font-bold font-display">Coach Suggested Answer</h3>
                </div>
                <p className="text-xs leading-6 whitespace-pre-wrap text-cyan-100">{props.suggestedAnswer}</p>
                {props.speakingTips.length > 0 ? (
                  <div className="mt-3.5 border-t border-cyan-900/40 pt-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 mb-1">Speaking Tips</p>
                    <ul className="space-y-1 text-xs text-cyan-200">
                      {props.speakingTips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <span className="text-cyan-400">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Feedback details, skeleton, or placeholder */}
          {isSubmitting ? (
            <FeedbackSkeleton />
          ) : props.lastTurn !== null && props.lastTurn !== undefined ? (
            <FeedbackPanel turn={props.lastTurn} />
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-line/60 bg-panel/30 p-10 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-slate-900 border border-line text-slate-400 mb-4">
                <Mic size={24} aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold font-display text-ink">Ready for your voice answer</h3>
              <p className="mt-2 text-xs leading-6 text-slate-400 max-w-sm mx-auto">
                Press "Answer" to start. Speak clearly in the selected language, then press "Stop" to trigger AI scoring.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Mobile sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur-lg md:hidden safe-area-bottom">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3">
          {/* Secondary actions row */}
          <div className="flex items-center gap-2 flex-1">
            {/* Coach Suggest — icon button on mobile */}
            <button
              className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl border border-line bg-slate-900/60 text-slate-200 hover:bg-slate-800 transition active:scale-[0.95] disabled:cursor-not-allowed disabled:text-slate-600 disabled:opacity-50"
              type="button"
              disabled={!props.canUseInterviewActions || props.isBusy}
              onClick={props.onSuggest}
              aria-label="Coach Suggest"
            >
              {isSuggesting ? (
                <svg className="animate-spin h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <Lightbulb size={20} aria-hidden="true" className="text-amber-400" />
              )}
            </button>

            {/* Retry — icon button on mobile */}
            <button
              className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl border border-line bg-slate-900/60 text-slate-200 hover:bg-slate-800 transition active:scale-[0.95] disabled:cursor-not-allowed disabled:text-slate-600 disabled:opacity-50"
              type="button"
              disabled={!props.canUseInterviewActions || props.isBusy || isRecording}
              onClick={props.onRetry}
              aria-label="Retry question"
            >
              <RotateCcw size={20} aria-hidden="true" />
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Next — secondary style on mobile */}
            <button
              className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-line bg-slate-900/60 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition active:scale-[0.97] disabled:cursor-not-allowed disabled:text-slate-600 disabled:opacity-50"
              type="button"
              disabled={!props.canUseInterviewActions || !props.lastTurn || props.isBusy || isRecording}
              onClick={props.onNextQuestion}
            >
              {isPlaying ? (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <>
                  <span>Next</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </>
              )}
            </button>

            {/* Answer / Stop — primary CTA, full prominence */}
            {isRecording ? (
              <button
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 py-3 text-sm font-bold text-white hover:bg-rose-500 transition active:scale-[0.97] animate-pulse-mic"
                type="button"
                onClick={props.onStopRecording}
              >
                <CircleStop size={20} aria-hidden="true" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-cyan-650 px-6 py-3 text-sm font-bold text-white hover:bg-cyan-500 transition active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:opacity-50 shadow-glow"
                type="button"
                disabled={!props.canUseInterviewActions || props.isBusy}
                onClick={props.onStartRecording}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Mic size={20} aria-hidden="true" />
                    <span>Answer</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

/* ─── Desktop action buttons (row layout) ─── */

type DesktopActionsProps = {
  readonly canUse: boolean;
  readonly isBusy: boolean;
  readonly isRecording: boolean;
  readonly isSubmitting: boolean;
  readonly isSuggesting: boolean;
  readonly isPlaying: boolean;
  readonly hasLastTurn: boolean;
  readonly onSuggest: () => Promise<void>;
  readonly onStartRecording: () => void;
  readonly onStopRecording: () => Promise<void>;
  readonly onRetry: () => void;
  readonly onNextQuestion: () => Promise<void>;
};

const DesktopActions = (p: DesktopActionsProps) => (
  <div className="flex gap-2">
    {/* Coach Suggest */}
    <button
      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-line bg-slate-900/60 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:border-slate-600 transition active:scale-[0.97] disabled:cursor-not-allowed disabled:text-slate-600 disabled:opacity-50"
      type="button"
      disabled={!p.canUse || p.isBusy}
      onClick={p.onSuggest}
    >
      {p.isSuggesting ? (
        <>
          <svg className="animate-spin h-3.5 w-3.5 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Suggesting...</span>
        </>
      ) : (
        <>
          <Lightbulb size={15} aria-hidden="true" className="text-amber-400" />
          <span>Coach Suggest</span>
        </>
      )}
    </button>

    {/* Answer / Stop */}
    {p.isRecording ? (
      <button
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-500 transition active:scale-[0.97] animate-pulse-mic"
        type="button"
        onClick={p.onStopRecording}
      >
        <CircleStop size={15} aria-hidden="true" />
        Stop
      </button>
    ) : (
      <button
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-cyan-650 px-4 py-2.5 text-xs font-bold text-white hover:bg-cyan-500 transition active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:opacity-50"
        type="button"
        disabled={!p.canUse || p.isBusy}
        onClick={p.onStartRecording}
      >
        {p.isSubmitting ? (
          <>
            <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Analyzing...</span>
          </>
        ) : (
          <>
            <Mic size={15} aria-hidden="true" />
            <span>Answer</span>
          </>
        )}
      </button>
    )}

    {/* Retry */}
    <button
      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-line bg-slate-900/60 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:border-slate-600 transition active:scale-[0.97] disabled:cursor-not-allowed disabled:text-slate-600 disabled:opacity-50"
      type="button"
      disabled={!p.canUse || p.isBusy || p.isRecording}
      onClick={p.onRetry}
    >
      <RotateCcw size={15} aria-hidden="true" />
      <span>Retry</span>
    </button>

    {/* Next */}
    <button
      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-650 px-4 py-2.5 text-xs font-bold text-white hover:from-cyan-500 hover:to-indigo-500 transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:from-slate-800 disabled:to-slate-800"
      type="button"
      disabled={!p.canUse || !p.hasLastTurn || p.isBusy || p.isRecording}
      onClick={p.onNextQuestion}
    >
      {p.isPlaying ? (
        <>
          <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Speaking...</span>
        </>
      ) : (
        <>
          <span>Next</span>
          <ArrowRight size={15} aria-hidden="true" />
        </>
      )}
    </button>
  </div>
);

const Badge = ({ children }: { children: ReactNode }) => (
  <span className="rounded-lg border border-line bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-200">
    {children}
  </span>
);

const statusText = (status: WorkStatus): string => {
  switch (status) {
    case "starting": return "Preparing your interview...";
    case "playing": return "Playing question...";
    case "suggesting": return "AI is writing a suggested answer...";
    case "recording": return "Recording... Speak clearly.";
    case "submitting": return "AI is evaluating your answer...";
    default: return "Ready. Click Answer to speak.";
  }
};

const categoryColorMap: Record<string, string> = {
  technical: "bg-cyan-950/60 border-cyan-800/50 text-cyan-300",
  behavioral: "bg-violet-950/60 border-violet-800/50 text-violet-300",
  system_design: "bg-amber-950/60 border-amber-800/50 text-amber-300",
  coding: "bg-emerald-950/60 border-emerald-800/50 text-emerald-300",
  situational: "bg-indigo-950/60 border-indigo-800/50 text-indigo-300",
};

const CategoryBadge = ({ category }: { category: string }) => {
  const colorClass = categoryColorMap[category.toLowerCase()] ?? "bg-slate-900/60 border-slate-700/50 text-slate-300";
  return (
    <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider border ${colorClass}`}>
      {category}
    </span>
  );
};
