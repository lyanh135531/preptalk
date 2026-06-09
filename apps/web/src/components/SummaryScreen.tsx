import type { InterviewLanguage, InterviewSession, InterviewTurn, Score } from "@preptalk/shared";
import { Award, ClipboardCheck, ClipboardCopy, Play, Sparkles } from "lucide-react";
import { useState } from "react";
import { buildInterviewSummary } from "../lib/summary";
import { ScoreGauge } from "./ScoreGauge";

type SummaryScreenProps = {
  readonly history: readonly InterviewTurn[];
  readonly session: InterviewSession;
  readonly onReset: () => void;
};

const languageLabels: Record<InterviewLanguage, string> = {
  vi: "Vietnamese",
  en: "English"
};

const scoreLabels: Record<keyof Score, string> = {
  communication: "Communication",
  roleRelevance: "Role Fit",
  structure: "Structure",
  languageAccuracy: "Language",
  confidence: "Confidence"
};

export const SummaryScreen = (props: SummaryScreenProps) => {
  const summary = buildInterviewSummary(props.history);
  const hasAnswers = props.history.length > 0;
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyText = (text: string, id: string): void => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  return (
    <section className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 animate-fade-in-up">
      {/* Header card */}
      <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">
            <Award size={15} />
            <span>Practice Completed</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold font-display text-ink">{props.session.role}</h1>
          <p className="mt-1.5 text-xs text-slate-400">
            Candidate: <span className="font-semibold text-slate-200">{props.session.candidateName}</span> · Language: <span className="font-semibold text-slate-200">{languageLabels[props.session.language]}</span>
          </p>
        </div>
        <button 
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-650 to-indigo-650 px-5 py-3 text-sm font-bold text-white hover:from-cyan-500 hover:to-indigo-500 transition active:scale-[0.98] shadow-glow" 
          type="button" 
          onClick={props.onReset}
        >
          New Practice Room
          <Play size={15} aria-hidden="true" />
        </button>
      </header>

      {hasAnswers ? (
        <div className="space-y-6 mt-6">
          {/* Average Scores section */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1fr_1.1fr]">
            <section className="rounded-2xl border border-line bg-panel/65 p-5 shadow-soft backdrop-blur-md glass-panel">
              <div className="flex items-center gap-2 mb-4 border-b border-line/45 pb-3">
                <Sparkles className="text-cyan-400" size={16} />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Average Scores</h2>
              </div>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                {Object.entries(summary.averageScore).map(([key, value]) => (
                  <ScoreGauge key={key} label={scoreLabels[key as keyof Score] ?? key} value={value as number} />
                ))}
              </div>
            </section>

            {/* Overall strengths & weaknesses */}
            <section className="grid gap-4 md:grid-cols-2">
              <SummaryList title="Overall Key Strengths" items={summary.strengths} cardStyle="border-emerald-500/10 bg-emerald-950/5" />
              <SummaryList title="General Areas to Practice" items={summary.improvements} cardStyle="border-amber-500/10 bg-amber-950/5" />
            </section>
          </div>

          {/* Q&A logs */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold font-display text-ink border-b border-line/60 pb-2.5">Detailed Question Logs</h2>
            {props.history.map((turn, index: number) => {
              const copyId = `corrected-${turn.id}`;
              const isCopied = copiedId === copyId;

              return (
                <div className="rounded-2xl border border-line bg-panel/45 p-5 backdrop-blur-md glass-panel" key={turn.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/45 pb-3 mb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Question {index + 1}
                      </span>
                      <span className="rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider border bg-slate-900/60 border-slate-700/50 text-slate-300">
                        {turn.question.category}
                      </span>
                    </div>
                    <span className="rounded-lg bg-indigo-950/45 border border-indigo-900/50 px-2.5 py-1 text-xs font-bold text-indigo-300">
                      Overall Score: {turn.feedback.score.communication}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-ink mb-4 font-display leading-7">{turn.question.text}</h3>
                  <div className="grid gap-5 lg:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Your Answer Transcript</p>
                      <p className="whitespace-pre-wrap rounded-xl border border-line bg-slate-950/70 p-4 text-xs leading-6 text-slate-300 min-h-[100px]">{turn.transcript}</p>
                    </div>
                    <div className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Coach Improved Answer</p>
                        <button
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-cyan-400 transition"
                          type="button"
                          onClick={() => handleCopyText(turn.correctedAnswer, copyId)}
                          title="Copy improved answer text"
                        >
                          {isCopied ? (
                            <>
                              <ClipboardCheck size={12} className="text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <ClipboardCopy size={12} />
                              <span>Copy text</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="whitespace-pre-wrap rounded-xl border border-line bg-slate-950/70 p-4 text-xs leading-6 text-slate-300 min-h-[100px]">{turn.correctedAnswer}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      ) : (
        <section className="mt-8 rounded-2xl border border-dashed border-line/60 bg-panel/35 p-10 text-center">
          <h2 className="text-lg font-bold font-display text-ink">No answers stored</h2>
          <p className="mt-2 text-xs text-slate-400">Start and complete at least one question in a practice session to view analytics.</p>
        </section>
      )}
    </section>
  );
};

type SummaryListProps = {
  readonly title: string;
  readonly items: readonly string[];
  readonly cardStyle?: string;
};

const SummaryList = ({ title, items, cardStyle = "" }: SummaryListProps) => (
  <section className={`rounded-2xl border border-line p-5 backdrop-blur-md glass-panel ${cardStyle}`}>
    <h3 className="font-bold text-sm text-ink mb-3 tracking-wide">{title}</h3>
    {items.length > 0 ? (
      <ul className="space-y-3 text-xs leading-5 text-slate-300">
        {items.map((item: string, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-cyan-500 mt-0.5">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-xs text-slate-400 italic">No aggregated insights generated yet.</p>
    )}
  </section>
);
