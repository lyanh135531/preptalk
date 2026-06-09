import type { FeedbackSpanType, InterviewTurn, Score } from "@preptalk/shared";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    corrected: true,
    scores: true,
  });

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const checkHighlighted = (spanText: string) => {
    if (!activeHighlight) return false;
    const spanLower = spanText.toLowerCase().trim();
    const highlightLower = activeHighlight.toLowerCase().trim();
    return spanLower.includes(highlightLower) || highlightLower.includes(spanLower);
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Transcript & Corrected Side-by-Side — always open */}
      <section className="rounded-2xl border border-line bg-panel/60 p-5 shadow-soft backdrop-blur-md glass-panel">
        <button
          className="flex w-full items-center justify-between gap-2 text-left"
          type="button"
          onClick={() => toggleSection("corrected")}
          aria-expanded={openSections["corrected"]}
        >
          <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-300">Answer Comparison</h3>
          {openSections["corrected"] ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {openSections["corrected"] ? (
          <div className="mt-4 grid gap-6 grid-cols-1 lg:grid-cols-2">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 mb-3">What You Said</h4>
              <p className="whitespace-pre-wrap rounded-xl border border-line bg-slate-950/70 p-4 leading-7 text-slate-200 text-sm">
                {turn.transcript}
              </p>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 mb-3">AI Improved Answer</h4>
              <div className="rounded-xl border border-line bg-slate-950/70 p-4 leading-8 text-sm">
                {turn.feedback.correctionSpans.map((span: { text: string; type: FeedbackSpanType }, index: number) => {
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
        ) : null}
      </section>

      {/* Radial Scores — always open */}
      <section className="rounded-2xl border border-line bg-panel/60 p-5 backdrop-blur-md glass-panel">
        <button
          className="flex w-full items-center justify-between gap-2 text-left"
          type="button"
          onClick={() => toggleSection("scores")}
          aria-expanded={openSections["scores"]}
        >
          <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-300">Performance Score</h3>
          {openSections["scores"] ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {openSections["scores"] ? (
          <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {Object.entries(turn.feedback.score).map(([key, value]) => (
              <ScoreGauge
                key={key}
                label={scoreLabels[key as keyof Score] ?? key}
                value={value as number}
              />
            ))}
          </div>
        ) : null}
      </section>

      {/* Collapsible feedback lists */}
      <FeedbackCollapsible
        title="Language & Grammar"
        items={turn.feedback.grammarFeedback}
        sectionKey="grammar"
        openSections={openSections}
        onToggle={toggleSection}
        accentColor="cyan"
      />
      <FeedbackCollapsible
        title="Content & Relevancy"
        items={turn.feedback.contentFeedback}
        sectionKey="content"
        openSections={openSections}
        onToggle={toggleSection}
        accentColor="indigo"
      />
      <FeedbackCollapsible
        title="Pronunciation Hints"
        items={turn.feedback.pronunciationHints}
        sectionKey="pronunciation"
        openSections={openSections}
        onToggle={toggleSection}
        accentColor="violet"
      />

      {/* Strengths & Improvements */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <FeedbackCollapsible
          title="Key Strengths"
          items={turn.feedback.strengths}
          sectionKey="strengths"
          openSections={openSections}
          onToggle={toggleSection}
          accentColor="emerald"
          alwaysOpen
        />
        <FeedbackCollapsible
          title="Areas to Improve"
          items={turn.feedback.improvements}
          sectionKey="improvements"
          openSections={openSections}
          onToggle={toggleSection}
          accentColor="amber"
          alwaysOpen
        />
      </div>

      {/* Detailed corrections with Hover Highlight Trigger */}
      {turn.feedback.issues.length > 0 ? (
        <section className="rounded-2xl border border-line bg-panel/60 p-5 backdrop-blur-md glass-panel">
          <button
            className="flex w-full items-center justify-between gap-2 text-left"
            type="button"
            onClick={() => toggleSection("corrections")}
            aria-expanded={openSections["corrections"]}
          >
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-300">Detailed Corrections</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{turn.feedback.issues.length} issues</span>
              {openSections["corrections"] ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </div>
          </button>

          {openSections["corrections"] ? (
            <div className="mt-4">
              <p className="text-xs text-slate-400 mb-4">Hover over cards to highlight corrected segments in the improved text above.</p>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                {turn.feedback.issues.map((issue: { type: string; originalText: string; suggestedText: string; explanation: string; severity: string }, index: number) => (
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
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
};

/* ─── Collapsible feedback section ─── */

type FeedbackCollapsibleProps = {
  readonly title: string;
  readonly items: readonly string[];
  readonly sectionKey: string;
  readonly openSections: Record<string, boolean>;
  readonly onToggle: (key: string) => void;
  readonly accentColor?: string;
  readonly alwaysOpen?: boolean;
};

const colorMap: Record<string, string> = {
  cyan: "border-cyan-500/10 hover:border-cyan-500/20",
  indigo: "border-indigo-500/10 hover:border-indigo-500/20",
  violet: "border-violet-500/10 hover:border-violet-500/20",
  emerald: "border-emerald-500/10 hover:border-emerald-500/20",
  amber: "border-amber-500/10 hover:border-amber-500/20",
};

const accentDot: Record<string, string> = {
  cyan: "bg-cyan-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
};

const FeedbackCollapsible = ({
  title,
  items,
  sectionKey,
  openSections,
  onToggle,
  accentColor = "cyan",
  alwaysOpen = false,
}: FeedbackCollapsibleProps) => {
  const isOpen = alwaysOpen || !!openSections[sectionKey];

  return (
    <section className={`rounded-xl border border-line bg-panel/40 p-5 transition-all duration-300 hover:shadow-sm ${colorMap[accentColor] ?? ""}`}>
      <button
        className="flex w-full items-center justify-between gap-2 text-left"
        type="button"
        onClick={() => !alwaysOpen && onToggle(sectionKey)}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <span className={`size-1.5 rounded-full ${accentDot[accentColor] ?? "bg-cyan-500"}`} aria-hidden="true" />
          <h3 className="font-bold text-sm text-ink tracking-wide">{title}</h3>
          <span className="text-[10px] font-bold text-slate-400">{items.length}</span>
        </div>
        {!alwaysOpen && (
          isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />
        )}
      </button>

      {isOpen ? (
        <div className="mt-3">
          {items.length > 0 ? (
            <ul className="space-y-2.5 text-xs leading-5 text-slate-300">
              {items.map((item: string, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5" aria-hidden="true">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400">No feedback points generated.</p>
          )}
        </div>
      ) : null}
    </section>
  );
};
