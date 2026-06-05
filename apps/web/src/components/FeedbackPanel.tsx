import type { FeedbackSpanType, InterviewTurn, Score } from "@preptalk/shared";
import { useState } from "react";
import { ScoreGauge } from "./ScoreGauge";

type FeedbackPanelProps = {
  readonly turn: InterviewTurn;
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

const scoreLabels: Record<keyof Score, string> = {
  communication: "Communication",
  roleRelevance: "Role Fit",
  structure: "Structure",
  languageAccuracy: "Language",
  confidence: "Confidence"
};

export const FeedbackPanel = ({ turn }: FeedbackPanelProps) => {
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);

  // Helper to determine if a span should be highlighted based on hover state
  const checkHighlighted = (spanText: string) => {
    if (!activeHighlight) return false;
    // Simple check: does the span include the hovered issue's suggested or original text?
    const spanLower = spanText.toLowerCase().trim();
    const highlightLower = activeHighlight.toLowerCase().trim();
    return spanLower.includes(highlightLower) || highlightLower.includes(spanLower);
  };

  return (
    <div className="space-y-6">
      {/* Transcript & Corrected Side-by-Side */}
      <section className="rounded-2xl border border-line bg-panel/60 p-5 shadow-soft backdrop-blur-md glass-panel">
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 mb-3">What You Said</h3>
            <p className="whitespace-pre-wrap rounded-xl border border-line bg-slate-950/70 p-4 leading-7 text-slate-200 text-sm">
              {turn.transcript}
            </p>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 mb-3">AI Improved Answer</h3>
            <div className="rounded-xl border border-line bg-slate-950/70 p-4 leading-8 text-sm">
              {turn.feedback.correctionSpans.map((span, index) => {
                const isHighlighted = checkHighlighted(span.text);
                const highlightStyle = isHighlighted
                  ? "ring-2 ring-cyan-400 bg-cyan-950/60 scale-105 inline-block font-semibold transition-all duration-200 shadow-glow"
                  : "";

                return (
                  <span
                    className={`mx-0.5 rounded px-1.5 py-0.5 transition-all duration-200 inline-block ${spanClassByType[span.type]} ${highlightStyle}`}
                    key={`${span.text}-${String(index)}`}
                  >
                    {span.text}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Radial Scores */}
      <section className="rounded-2xl border border-line bg-panel/60 p-5 backdrop-blur-md glass-panel">
        <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400 mb-4">Performance Score</h3>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {Object.entries(turn.feedback.score).map(([key, value]) => (
            <ScoreGauge
              key={key}
              label={scoreLabels[key as keyof Score]}
              value={value}
            />
          ))}
        </div>
      </section>

      {/* AI Bullet points list */}
      <section className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <FeedbackList title="Language & Grammar" items={turn.feedback.grammarFeedback} cardStyle="border-cyan-500/10 hover:border-cyan-500/20" />
        <FeedbackList title="Content & Relevancy" items={turn.feedback.contentFeedback} cardStyle="border-indigo-500/10 hover:border-indigo-500/20" />
        <FeedbackList title="Pronunciation Hints" items={turn.feedback.pronunciationHints} cardStyle="border-violet-500/10 hover:border-violet-500/20" />
      </section>

      <section className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <FeedbackList title="Key Strengths" items={turn.feedback.strengths} cardStyle="border-emerald-500/10 hover:border-emerald-500/20" />
        <FeedbackList title="Areas to Improve" items={turn.feedback.improvements} cardStyle="border-amber-500/10 hover:border-amber-500/20" />
      </section>

      {/* Detailed corrections with Hover Highlight Trigger */}
      {turn.feedback.issues.length > 0 ? (
        <section className="rounded-2xl border border-line bg-panel/60 p-5 backdrop-blur-md glass-panel">
          <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400 mb-4">Detailed Corrections</h3>
          <p className="text-xs text-slate-400 mb-4">Hover over cards to highlight corrected segments in the improved text above.</p>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            {turn.feedback.issues.map((issue, index) => (
              <div
                className="rounded-xl border border-line bg-slate-950/45 p-4 transition-all duration-300 hover:border-cyan-500/40 hover:bg-slate-950/75 cursor-default hover:shadow-glow"
                key={`${issue.type}-${issue.originalText}-${issue.suggestedText}-${String(index)}`}
                onMouseEnter={() => setActiveHighlight(issue.suggestedText)}
                onMouseLeave={() => setActiveHighlight(null)}
              >
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider rounded bg-slate-800 px-2 py-0.5 text-slate-300">
                    {issue.type.replace("_", " ")}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider rounded px-2 py-0.5 ${
                    issue.severity === "high"
                      ? "bg-rose-950/50 text-rose-300 border border-rose-500/30"
                      : issue.severity === "medium"
                      ? "bg-amber-950/50 text-amber-300 border border-amber-500/30"
                      : "bg-slate-900 text-slate-400 border border-slate-700/50"
                  }`}>
                    {issue.severity} priority
                  </span>
                </div>
                <div className="text-sm leading-6 mb-2">
                  <span className="font-semibold text-rose-400 line-through mr-2">{issue.originalText}</span>
                  <span className="text-slate-400 mr-2">→</span>
                  <span className="font-semibold text-emerald-400">{issue.suggestedText}</span>
                </div>
                <p className="text-xs leading-5 text-slate-300">{issue.explanation}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

type FeedbackListProps = {
  readonly title: string;
  readonly items: readonly string[];
  readonly cardStyle?: string;
};

const FeedbackList = ({ title, items, cardStyle = "" }: FeedbackListProps) => (
  <section className={`rounded-xl border border-line bg-panel/40 p-5 transition-all duration-300 hover:shadow-sm ${cardStyle}`}>
    <h3 className="font-bold text-sm text-ink mb-3 tracking-wide">{title}</h3>
    {items.length > 0 ? (
      <ul className="space-y-2.5 text-xs leading-5 text-slate-300">
        {items.map((item: string, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-cyan-500 mt-0.5">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-xs text-slate-500">No feedback points generated.</p>
    )}
  </section>
);
