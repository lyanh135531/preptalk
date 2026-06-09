import type { InterviewLanguage, StoredInterview } from "@preptalk/shared";
import { predefinedRoles } from "@preptalk/shared";
import {
  ArrowRight, Brain, ChevronLeft, ChevronRight,
  Headphones, Mic, Play, Sparkles, Zap
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

type SetupScreenProps = {
  readonly candidateName: string;
  readonly customRole: string;
  readonly errorMessage: string | null;
  readonly language: InterviewLanguage;
  readonly selectedRole: string;
  readonly yearsOfExperience: string;
  readonly storedInterview: StoredInterview | null;
  readonly onCandidateNameChange: (value: string) => void;
  readonly onCustomRoleChange: (value: string) => void;
  readonly onLanguageChange: (value: InterviewLanguage) => void;
  readonly onProfileSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onResume: () => void;
  readonly onSelectedRoleChange: (value: string) => void;
  readonly onYearsOfExperienceChange: (value: string) => void;
};

const customRoleValue = "__custom_role__";
const totalSteps = 3;

export const SetupScreen = (props: SetupScreenProps) => {
  const [step, setStep] = useState(1);
  const [typedText, setTypedText] = useState("");
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const headlineRef = useRef<HTMLSpanElement>(null);

  const fullHeadline = "Practice interviews with ";

  // Typing animation for headline
  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (i <= fullHeadline.length) {
        setTypedText(fullHeadline.slice(0, i));
        i++;
      } else {
        clearInterval(timer);
        setTimeout(() => setShowSubtitle(true), 200);
        setTimeout(() => setShowForm(true), 600);
      }
    }, 40);
    return () => clearInterval(timer);
  }, []);

  const validateStep = (currentStep: number): boolean => {
    if (currentStep === 1) return props.candidateName.trim().length > 0;
    if (currentStep === 2) {
      const role = props.selectedRole === customRoleValue ? props.customRole.trim() : props.selectedRole;
      return role.length >= 2;
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep(step) && step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleNextStep();
    }
  };

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-line/40 pb-5">
        <div className="flex items-center gap-3">
          <div className="relative flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-white shadow-glow-lg">
            <Brain size={22} aria-hidden="true" />
            <span className="absolute -inset-1 rounded-xl bg-cyan-400/20 animate-pulse-slow" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-400">PrepTalk</p>
            <h1 className="text-lg sm:text-xl font-bold font-display text-ink">AI Interview Practice</h1>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-line/60 bg-slate-900/50 px-3.5 py-1.5 text-xs font-medium text-slate-400 sm:flex">
            <Sparkles size={13} className="text-cyan-400" aria-hidden="true" />
            <span>AI-Powered</span>
            <span className="text-line">•</span>
            <span>Real-time Feedback</span>
          </div>
      </header>

      {/* Resume session banner */}
      {props.storedInterview !== null ? (
        <div className="mt-6 animate-slide-down">
          <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-950/40 to-indigo-950/30 p-4 sm:p-5 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                  <Play size={18} className="text-cyan-400" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-bold text-ink">{props.storedInterview.session.candidateName}</p>
                  <p className="text-xs text-slate-400">{props.storedInterview.session.role} · {props.storedInterview.history.length} questions answered</p>
                </div>
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white transition-all hover:from-cyan-500 hover:to-indigo-500 hover:shadow-glow active:scale-[0.97]"
                type="button"
                onClick={props.onResume}
              >
                Resume Session
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Hero + Form Grid */}
      <div className="flex-1 flex flex-col items-center justify-center py-8 sm:py-12">
        {/* Hero Text */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-display leading-tight text-ink">
            <span>{typedText}</span>
            <span className="relative">
              <span
                ref={headlineRef}
                className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400"
              >
                {typedText.length > fullHeadline.length ? "live AI feedback" : ""}
              </span>
              <span className="animate-blink absolute -right-1 top-0 h-full w-0.5 bg-cyan-400" />
            </span>
          </h2>

          {showSubtitle ? (
            <div className="animate-fade-in-up mt-5">
              <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-lg mx-auto">
                Master your interview skills with realistic AI voice practice.
                Get instant feedback on communication, clarity, and confidence.
              </p>
              <div className="mt-5 flex items-center justify-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><Zap size={12} className="text-amber-400" /> Real-time AI</span>
                <span className="flex items-center gap-1.5"><Mic size={12} className="text-cyan-400" /> Voice Practice</span>
                <span className="flex items-center gap-1.5"><Headphones size={12} className="text-indigo-400" /> Instant Review</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Form Card */}
        {showForm ? (
          <div className="w-full max-w-lg animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            <form
              className="relative rounded-3xl border border-line/60 bg-panel/50 p-6 sm:p-8 shadow-2xl backdrop-blur-xl glass-panel overflow-hidden"
              onSubmit={(e) => {
                e.preventDefault();
                if (step === totalSteps) {
                  props.onProfileSubmit(e);
                } else {
                  handleNextStep();
                }
              }}
            >
              {/* Decorative gradient */}
              <div className="absolute -top-24 -right-24 size-48 rounded-full bg-cyan-500/5 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 size-48 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />

              {/* Progress */}
              <div className="relative mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold font-display text-ink">
                    {step === 1 && "What's your name?"}
                    {step === 2 && "Choose your target role"}
                    {step === 3 && "Years of experience?"}
                  </h3>
                  <span className="text-xs font-medium text-slate-500">{step}/{totalSteps}</span>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3].map((s) => (
                    <div
                      key={s}
                      className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                        s <= step
                          ? "bg-gradient-to-r from-cyan-500 to-indigo-500"
                          : "bg-line/40"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Step 1: Name */}
              <div className={`relative transition-all duration-400 ${step === 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 absolute pointer-events-none"}`}>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Your Name
                </label>
                <input
                  className="w-full rounded-2xl custom-input px-5 py-4 text-lg text-ink shadow-sm placeholder:text-slate-500 focus:shadow-glow transition-shadow"
                  placeholder="e.g. Alex Nguyen"
                  value={props.candidateName}
                  onChange={(event) => props.onCandidateNameChange(event.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="name"
                  autoFocus
                />
                <p className="mt-2 text-xs text-slate-500">This helps the AI personalize your interview experience.</p>
              </div>

              {/* Step 2: Role */}
              <div className={`relative transition-all duration-400 ${step === 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 absolute pointer-events-none"}`}>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Target Role
                </label>
                <select
                  className="w-full rounded-2xl custom-input px-5 py-4 text-lg text-ink shadow-sm focus:shadow-glow transition-shadow"
                  value={props.selectedRole}
                  onChange={(event) => props.onSelectedRoleChange(event.target.value)}
                  autoFocus
                >
                  {predefinedRoles.map((role: string) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                  <option value={customRoleValue}>Other / Custom Role...</option>
                </select>

                {props.selectedRole === customRoleValue ? (
                  <div className="mt-4 animate-fade-in">
                    <input
                      className="w-full rounded-2xl custom-input px-5 py-4 text-lg text-ink shadow-sm placeholder:text-slate-500 focus:shadow-glow transition-shadow"
                      placeholder="e.g. Sales Operations Manager"
                      value={props.customRole}
                      onChange={(event) => props.onCustomRoleChange(event.target.value)}
                      autoFocus
                    />
                  </div>
                ) : null}

                {/* Language selector */}
                <div className="mt-4">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Interview Language
                  </label>
                  <div className="flex gap-3">
                    {(["en", "vi"] as const).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                          props.language === lang
                            ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 shadow-glow-sm"
                            : "border border-line/60 bg-slate-900/40 text-slate-400 hover:border-line hover:text-slate-300"
                        }`}
                        onClick={() => props.onLanguageChange(lang)}
                      >
                        {lang === "en" ? "🇺🇸 English" : "🇻🇳 Vietnamese"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step 3: Experience */}
              <div className={`relative transition-all duration-400 ${step === 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 absolute pointer-events-none"}`}>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Years of Experience
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "0-1 years", label: "0-1 years", sub: "Junior / Entry" },
                    { value: "2-4 years", label: "2-4 years", sub: "Mid-level" },
                    { value: "5-8 years", label: "5-8 years", sub: "Senior" },
                    { value: "9+ years", label: "9+ years", sub: "Lead / Principal" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`rounded-xl px-4 py-4 text-left transition-all ${
                        props.yearsOfExperience === opt.value
                          ? "bg-cyan-500/15 border-2 border-cyan-500/30 text-cyan-300 shadow-glow-sm"
                          : "border border-line/60 bg-slate-900/40 text-slate-400 hover:border-line hover:text-slate-300"
                      }`}
                      onClick={() => props.onYearsOfExperienceChange(opt.value)}
                    >
                      <p className="text-sm font-bold">{opt.label}</p>
                      <p className="text-xs opacity-60 mt-0.5">{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {props.errorMessage !== null ? (
                <div className="mt-5 rounded-xl border border-rose-500/20 bg-rose-950/20 px-4 py-3 text-xs leading-6 text-rose-300 animate-shake" role="alert">
                  {props.errorMessage}
                </div>
              ) : null}

              {/* Navigation */}
              <div className="mt-8 flex items-center justify-between gap-3">
                {step > 1 ? (
                  <button
                    className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all active:scale-[0.97]"
                    type="button"
                    onClick={() => setStep(step - 1)}
                  >
                    <ChevronLeft size={16} />
                    Back
                  </button>
                ) : (
                  <div />
                )}

                <button
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold transition-all active:scale-[0.97] ${
                    step === totalSteps
                      ? "bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-glow hover:shadow-glow-lg hover:from-cyan-400 hover:to-indigo-500 min-w-[180px]"
                      : "bg-cyan-600 text-white hover:bg-cyan-500 shadow-glow-sm"
                  } ${!validateStep(step) ? "opacity-50 cursor-not-allowed" : ""}`}
                  type="submit"
                  disabled={!validateStep(step)}
                >
                  {step === totalSteps ? (
                    <>
                      Start Interview
                      <ArrowRight size={16} className="animate-bounce-x" />
                    </>
                  ) : (
                    <>
                      Continue
                      <ChevronRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Social proof */}
            <div className="mt-6 text-center animate-fade-in" style={{ animationDelay: "0.5s" }}>
              <p className="text-xs text-slate-500">
                Join <span className="font-semibold text-slate-300">10,000+</span> candidates who practiced with PrepTalk
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};
