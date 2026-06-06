import type { InterviewLanguage, StoredInterview } from "@preptalk/shared";
import { predefinedRoles } from "@preptalk/shared";
import { ArrowRight, Brain, ChevronRight, Headphones, Sparkles } from "lucide-react";
import type { FormEvent } from "react";

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

export const SetupScreen = (props: SetupScreenProps) => (
  <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
    {/* Header */}
    <header className="flex items-center justify-between border-b border-line/60 pb-5">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-600 to-indigo-600 text-white shadow-glow">
          <Brain size={22} className="animate-pulse" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-400">PrepTalk</p>
          <h1 className="text-xl font-bold font-display text-ink sm:text-2xl">AI Interview Practice</h1>
        </div>
      </div>
      <div className="hidden items-center gap-2 rounded-full border border-line bg-slate-900/40 px-3.5 py-1.5 text-xs font-semibold text-slate-300 sm:flex">
        <Sparkles size={14} className="text-cyan-400" aria-hidden="true" />
        <span>Realistic voice practice</span>
      </div>
    </header>

    {/* Content Grid */}
    <div className="grid flex-1 items-center gap-10 py-10 grid-cols-1 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-8">
        <div className="max-w-xl space-y-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">Practice & Succeed</p>
          <h2 className="text-4xl font-extrabold font-display leading-tight text-ink sm:text-5xl lg:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-ink via-slate-100 to-slate-400">
            Practice interviews with live feedback.
          </h2>
          <p className="text-base sm:text-lg leading-8 text-slate-300">
            Choose a role, answer by voice, and receive instant corrections after every response to perfect your style.
          </p>
        </div>

        <div className="grid gap-4 grid-cols-3">
          <Metric label="Voice Mode" value="Listen & Speak" description="Fully conversational" />
          <Metric label="Instant Feedback" value="Real-time reviews" description="Grammar & clarity" />
          <Metric label="Analytics" value="Score Overview" description="End-session report" />
        </div>
      </div>

      <form 
        className="rounded-2xl border border-line bg-panel/75 p-6 shadow-soft sm:p-8 backdrop-blur-md glass-panel" 
        onSubmit={props.onProfileSubmit}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold font-display text-ink">Start Session</h3>
            <p className="mt-1 text-xs text-slate-400">Set up your candidate profile and target job.</p>
          </div>
          <div className="rounded-lg bg-cyan-950/40 border border-cyan-800/40 p-2.5">
            <Headphones className="text-cyan-400" size={24} aria-hidden="true" />
          </div>
        </div>

        {props.storedInterview !== null ? (
          <div className="mb-6 rounded-xl border border-cyan-500/20 bg-cyan-950/30 p-4 transition-all hover:bg-cyan-950/45">
            <p className="text-xs font-bold uppercase tracking-wide text-cyan-400">Unfinished session found</p>
            <p className="mt-1 text-sm font-semibold text-ink">
              {props.storedInterview.session.candidateName} · {props.storedInterview.session.role}
            </p>
            <button
              className="mt-3.5 inline-flex items-center gap-2 rounded-lg bg-cyan-650 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-cyan-500 active:scale-[0.97]"
              type="button"
              onClick={props.onResume}
            >
              Resume Practice
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Your Name
            </label>
            <input
              className="mt-2 w-full rounded-xl custom-input px-4 py-3 text-base text-ink shadow-sm placeholder:text-slate-500"
              placeholder="Example: Alex Nguyen"
              value={props.candidateName}
              onChange={(event) => props.onCandidateNameChange(event.target.value)}
              autoComplete="name"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Interview Language
            </label>
            <select
              className="mt-2 w-full rounded-xl custom-input px-4 py-3 text-base text-ink shadow-sm"
              value={props.language}
              onChange={(event) => props.onLanguageChange(event.target.value as InterviewLanguage)}
            >
              <option value="en">English (US)</option>
              <option value="vi">Vietnamese (Vietnam)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Years of Experience
            </label>
            <select
              className="mt-2 w-full rounded-xl custom-input px-4 py-3 text-base text-ink shadow-sm"
              value={props.yearsOfExperience}
              onChange={(event) => props.onYearsOfExperienceChange(event.target.value)}
            >
              <option value="0-1 years">0-1 years (Junior / Entry-level)</option>
              <option value="2-4 years">2-4 years (Mid-level)</option>
              <option value="5-8 years">5-8 years (Senior)</option>
              <option value="9+ years">9+ years (Lead / Principal)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Target Role or Industry
            </label>
            <select
              className="mt-2 w-full rounded-xl custom-input px-4 py-3 text-base text-ink shadow-sm"
              value={props.selectedRole}
              onChange={(event) => props.onSelectedRoleChange(event.target.value)}
            >
              {predefinedRoles.map((role: string) => (
                <option key={role} value={role}>{role}</option>
              ))}
              <option value={customRoleValue}>Other / Custom Role...</option>
            </select>
          </div>

          {props.selectedRole === customRoleValue ? (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Custom Role Title
              </label>
              <input
                className="mt-2 w-full rounded-xl custom-input px-4 py-3 text-base text-ink shadow-sm placeholder:text-slate-500"
                placeholder="Example: Sales Operations Manager"
                value={props.customRole}
                onChange={(event) => props.onCustomRoleChange(event.target.value)}
              />
            </div>
          ) : null}
        </div>

        {props.errorMessage !== null ? (
          <div className="mt-5 rounded-xl border border-rose-500/20 bg-rose-950/20 px-4 py-3 text-xs leading-6 text-rose-300">
            {props.errorMessage}
          </div>
        ) : null}

        <button 
          className="mt-7 inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-cyan-650 px-5 py-3 text-base font-bold text-white transition hover:bg-cyan-500 active:scale-[0.98] shadow-glow" 
          type="submit"
        >
          Start Interview
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </form>
    </div>
  </section>
);

type MetricProps = {
  readonly label: string;
  readonly value: string;
  readonly description: string;
};

const Metric = ({ label, value, description }: MetricProps) => (
  <div className="rounded-xl border border-line bg-panel/40 p-4 transition-all duration-300 hover:border-slate-700">
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
    <p className="mt-1.5 text-base font-bold text-ink font-display">{value}</p>
    <p className="mt-1 text-[11px] text-slate-400">{description}</p>
  </div>
);
