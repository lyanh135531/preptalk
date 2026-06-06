import type { ReactNode } from "react";
import type { InterviewLanguage, InterviewSession, InterviewTurn, Question } from "@preptalk/shared";
import { 
  ArrowRight, Award, Brain, CircleStop, Lightbulb, 
  Mic, RotateCcw, Trash2, Volume2 
} from "lucide-react";
import { AudioVisualizer } from "./AudioVisualizer";
import { FeedbackPanel } from "./FeedbackPanel";

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
};

const languageLabels: Record<InterviewLanguage, string> = {
  vi: "Vietnamese",
  en: "English"
};

export const InterviewScreen = (props: InterviewScreenProps) => {
  const currentQNum = props.session.currentQuestionNumber;
  return (
    <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
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
          <section className="rounded-2xl border border-line bg-panel/65 p-5 shadow-soft backdrop-blur-md glass-panel">
            <div className="mb-4 flex items-center justify-between gap-4">
              <span className="rounded bg-cyan-950/60 border border-cyan-800/40 px-2.5 py-1 text-xs font-bold text-cyan-300 uppercase tracking-wide">
                Question {currentQNum}
              </span>
              <button
                className="inline-flex size-11 items-center justify-center rounded-xl border border-line text-cyan-300 bg-slate-900/50 hover:bg-cyan-950/40 hover:border-cyan-500/30 transition-all disabled:cursor-not-allowed disabled:text-slate-600 disabled:bg-transparent"
                type="button"
                title="Replay audio of question"
                disabled={props.isBusy}
                onClick={props.onReplay}
              >
                <Volume2 size={20} aria-hidden="true" />
              </button>
            </div>
            <p className="text-xl font-bold leading-9 text-ink font-display">{props.currentQuestion.text}</p>
            
            <div className="mt-5 border-t border-line/50 pt-4 flex flex-col gap-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Rationale for this topic:</span>
              <p className="leading-5">{props.currentQuestion.rationale}</p>
            </div>
          </section>

          {/* History log */}
          <section className="rounded-2xl border border-line bg-panel/65 p-5 backdrop-blur-md glass-panel">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Turn Log</h2>
            <div className="mt-4 space-y-3 max-h-[200px] overflow-y-auto pr-1">
              {props.history.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Conversations will appear here once you start answering.</p>
              ) : props.history.map((turn, index: number) => (
                <div className="rounded-xl border border-line bg-slate-950/30 p-3 flex gap-3 items-center justify-between" key={turn.id}>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Q{index + 1} Answered</p>
                    <p className="mt-1 line-clamp-1 text-xs font-medium text-slate-300">{turn.question.text}</p>
                  </div>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                    {turn.feedback.score.communication} pts
                  </span>
                </div>
              ))}
            </div>
          </section>
        </aside>

        {/* Right Side: Answer Capture & Feedback Area */}
        <section className="space-y-4 order-1 lg:order-2">
          
          {/* Action Pad */}
          <div className="rounded-2xl border border-line bg-panel/65 p-5 shadow-soft backdrop-blur-md glass-panel">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-bold text-ink">Speech Recorder</h2>
                <p className="mt-0.5 text-xs text-slate-400">{statusText(props.workStatus)}</p>
              </div>
              <div className="hidden gap-2 md:flex">
                <InterviewActions {...props} />
              </div>
            </div>

            {props.errorMessage !== null ? (
              <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-950/20 px-4 py-3 text-xs leading-6 text-rose-300">
                {props.errorMessage}
              </div>
            ) : null}

            {props.noticeMessage !== null ? (
              <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-950/20 px-4 py-3 text-xs leading-6 text-cyan-300">
                {props.noticeMessage}
              </div>
            ) : null}

            {/* Audio Waveform active visualization */}
            {props.workStatus === "recording" && (
              <div className="mt-4">
                <AudioVisualizer />
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

          {/* Feedback details or placeholder */}
          {props.lastTurn !== null && props.lastTurn !== undefined ? (
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

      {/* Floating control bar for mobile layout */}
      <div className="sticky bottom-0 z-10 border-t border-line bg-surface/90 py-3.5 backdrop-blur-md md:hidden">
        <InterviewActions {...props} />
      </div>
    </section>
  );
};

const InterviewActions = (props: InterviewScreenProps) => (
  <div className="grid grid-cols-2 gap-2 sm:flex">
    {/* Coach Suggest button */}
    <button
      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-line bg-slate-900/60 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:border-slate-600 transition active:scale-[0.97] disabled:cursor-not-allowed disabled:text-slate-600 disabled:opacity-50"
      type="button"
      disabled={!props.canUseInterviewActions || props.isBusy}
      onClick={props.onSuggest}
    >
      {props.workStatus === "suggesting" ? (
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

    {/* Voice record action */}
    {props.workStatus === "recording" ? (
      <button
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-500 transition active:scale-[0.97] animate-pulse-mic"
        type="button"
        onClick={props.onStopRecording}
      >
        <CircleStop size={15} aria-hidden="true" />
        Stop
      </button>
    ) : (
      <button
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-cyan-650 px-4 py-2.5 text-xs font-bold text-white hover:bg-cyan-500 transition active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:opacity-50"
        type="button"
        disabled={!props.canUseInterviewActions || props.isBusy}
        onClick={props.onStartRecording}
      >
        {props.workStatus === "submitting" ? (
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

    {/* Retry button */}
    <button
      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-line bg-slate-900/60 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:border-slate-600 transition active:scale-[0.97] disabled:cursor-not-allowed disabled:text-slate-600 disabled:opacity-50"
      type="button"
      disabled={!props.canUseInterviewActions || props.isBusy || props.workStatus === "recording"}
      onClick={props.onRetry}
    >
      <RotateCcw size={15} aria-hidden="true" />
      <span>Retry</span>
    </button>

    {/* Next/Finish button */}
    <button
      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-650 px-4 py-2.5 text-xs font-bold text-white hover:from-cyan-500 hover:to-indigo-500 transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:from-slate-800 disabled:to-slate-800"
      type="button"
      disabled={!props.canUseInterviewActions || !props.lastTurn || props.isBusy || props.workStatus === "recording"}
      onClick={props.onNextQuestion}
    >
      {props.workStatus === "playing" ? (
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
    case "starting": return "AI Interviewer is generating question...";
    case "playing": return "Robotic voice is speaking. Listen closely.";
    case "suggesting": return "AI is constructing suggested answer...";
    case "recording": return "Glow Mic active. Answer now, speak clearly.";
    case "submitting": return "AI is analyzing your voice response...";
    default: return "Ready. Click Answer to speak.";
  }
};
