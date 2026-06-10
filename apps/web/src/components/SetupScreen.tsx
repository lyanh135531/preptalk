import type { CvAnalysis, CvJdMatch, InterviewLanguage, JdAnalysis, StoredInterview } from "@preptalk/shared";
import { predefinedRoles } from "@preptalk/shared";
import {
  ArrowRight,
  Brain,
  ChevronLeft,
  ChevronRight,
  FileText,
  Headphones,
  Play,
  Sparkles,
  Upload,
  Zap,
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
  readonly cvAnalysis: CvAnalysis | null;
  readonly jdAnalysis: JdAnalysis | null;
  readonly cvJdMatch: CvJdMatch | null;
  readonly cvFile: { fileId: string; fileName: string } | null;
  readonly jdText: string;
  readonly isParsingCv: boolean;
  readonly isAnalyzingJd: boolean;
  readonly isMatching: boolean;
  readonly onCandidateNameChange: (value: string) => void;
  readonly onCustomRoleChange: (value: string) => void;
  readonly onLanguageChange: (value: InterviewLanguage) => void;
  readonly onProfileSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onResume: () => void;
  readonly onCvUpload: (file: File) => void;
  readonly onJdTextChange: (value: string) => void;
  readonly onAnalyzeJd: (jdText: string) => void;
  readonly onMatchCvJd: () => void;
  readonly onSkipCv: () => void;
  readonly onSkipJd: () => void;
  readonly onSelectedRoleChange: (value: string) => void;
  readonly onYearsOfExperienceChange: (value: string) => void;
};

const customRoleValue = "__custom_role__";
const totalSteps = 6;

export const SetupScreen = (props: SetupScreenProps) => {
  const [step, setStep] = useState(1);
  const [typedText, setTypedText] = useState("");
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [jdText, setJdText] = useState(props.jdText ?? "");
  const [dragOver, setDragOver] = useState(false);
  const headlineRef = useRef<HTMLSpanElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fullHeadline = "Practice interviews with ";

  // Sync JD text từ cache khi mount
  useEffect(() => {
    if (props.jdText) {
      setJdText(props.jdText);
    }
  }, [props.jdText]);

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
    if (currentStep === 2) return true; // CV upload is optional (can skip)
    if (currentStep === 3) return true; // JD is optional (can skip)
    if (currentStep === 4) return true; // Match review — always can proceed
    if (currentStep === 5) {
      const role =
        props.selectedRole === customRoleValue
          ? props.customRole.trim()
          : props.selectedRole;
      return role.length >= 2;
    }
    return true; // Step 6 — experience
  };

  const handleNextStep = () => {
    if (validateStep(step) && step < totalSteps) {
      // Step 3 → 4: trigger match if both CV and JD are available
      if (step === 3 && props.cvAnalysis && props.jdAnalysis && !props.cvJdMatch && !props.isMatching) {
        props.onMatchCvJd();
      }
      setStep(step + 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleNextStep();
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      props.onCvUpload(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      props.onCvUpload(file);
    }
  };

  const skipCvAndGoToJd = () => {
    props.onSkipCv();
    setStep(3);
  };

  const skipJdAndGoToReview = () => {
    props.onSkipJd();
    setStep(4);
  };

  const renderStepTitle = () => {
    switch (step) {
      case 1: return "What's your name?";
      case 2: return "Upload your CV";
      case 3: return "Job description";
      case 4: return "CV × JD Match";
      case 5: return "Target role";
      case 6: return "Experience level";
      default: return "";
    }
  };

  const renderProgressBars = () => {
    return (
      <div className="flex gap-2">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
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
    );
  };

  const renderMatchScore = () => {
    const score = props.cvJdMatch?.matchScore ?? 0;
    const color =
      score >= 75 ? "text-emerald-400" :
      score >= 50 ? "text-amber-400" :
      "text-rose-400";
    const label =
      score >= 75 ? "Strong Match" :
      score >= 50 ? "Good Match" :
      "Needs Improvement";
    return (
      <div className="flex flex-col items-center">
        <div className="relative size-24">
          <svg className="size-24 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-line/20" />
            <circle
              cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8"
              strokeDasharray={`${score * 2.64} ${264 - score * 2.64}`}
              strokeLinecap="round"
              className={color}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-2xl font-extrabold ${color}`}>{score}%</span>
          </div>
        </div>
        <p className={`mt-2 text-sm font-bold ${color}`}>{label}</p>
      </div>
    );
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
                  <p className="text-xs text-slate-400">
                    {props.storedInterview.session.role} · {props.storedInterview.history.length} questions answered
                  </p>
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

      {/* Hero + Form */}
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
                Upload your CV and job description for a personalized experience.
              </p>
              <div className="mt-5 flex items-center justify-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><Zap size={12} className="text-amber-400" /> CV Analysis</span>
                <span className="flex items-center gap-1.5"><FileText size={12} className="text-cyan-400" /> JD Matching</span>
                <span className="flex items-center gap-1.5"><Headphones size={12} className="text-indigo-400" /> Targeted Q&A</span>
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
              {/* Decorative gradients */}
              <div className="absolute -top-24 -right-24 size-48 rounded-full bg-cyan-500/5 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 size-48 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />

              {/* Progress */}
              <div className="relative mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold font-display text-ink">{renderStepTitle()}</h3>
                  <span className="text-xs font-medium text-slate-500">{step}/{totalSteps}</span>
                </div>
                {renderProgressBars()}
              </div>

              {/* Step 1: Name */}
              {step === 1 && (
                <div className="animate-fade-in-up">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Your Name</label>
                  <input
                    className="w-full rounded-2xl custom-input px-5 py-3 text-base text-ink shadow-sm placeholder:text-slate-400 focus:shadow-glow transition-shadow"
                    placeholder="e.g. Lian"
                    value={props.candidateName}
                    onChange={(event) => props.onCandidateNameChange(event.target.value)}
                    onKeyDown={handleKeyDown}
                    autoComplete="name"
                    autoFocus
                  />
                  <p className="mt-1.5 text-xs text-slate-500">This helps the AI personalize your interview experience.</p>
                </div>
              )}

              {/* Step 2: CV Upload */}
              {step === 2 && (
                <div className="animate-fade-in-up">
                  {props.cvAnalysis ? (
                    /* CV parsed successfully */
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4">
                        <FileText size={20} className="text-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-emerald-300">CV analyzed successfully!</p>
                          <p className="text-xs text-slate-400 mt-0.5 truncate">
                            {props.cvFile?.fileName ? `${props.cvFile.fileName} · ` : ""}
                            {props.cvAnalysis.candidateName && `${props.cvAnalysis.candidateName} · `}
                            {props.cvAnalysis.skills.length} skills · {props.cvAnalysis.experience.length} roles
                          </p>
                        </div>
                      </div>
                      {props.cvAnalysis.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {props.cvAnalysis.skills.slice(0, 8).map((skill) => (
                            <span key={skill} className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 text-xs font-medium text-cyan-300">
                              {skill}
                            </span>
                          ))}
                          {props.cvAnalysis.skills.length > 8 && (
                            <span className="text-xs text-slate-500 px-1 py-1">+{props.cvAnalysis.skills.length - 8} more</span>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-slate-500">You can continue or skip the job description step.</p>
                    </div>
                  ) : props.isParsingCv ? (
                    /* Parsing state */
                    <div className="flex flex-col items-center gap-3 py-6">
                      <svg className="animate-spin h-8 w-8 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <p className="text-sm text-slate-400">Analyzing your CV...</p>
                      <p className="text-xs text-slate-500">This may take a few seconds</p>
                    </div>
                  ) : (
                    /* Upload zone */
                    <div>
                      <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
                      <div
                        className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
                          dragOver
                            ? "border-cyan-400 bg-cyan-500/10"
                            : "border-line/40 bg-slate-900/20 hover:border-line hover:bg-slate-800/30"
                        }`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleFileDrop}
                      >
                        <div className="flex size-14 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
                          <Upload size={24} className="text-cyan-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-ink">Drop your CV here or click to browse</p>
                          <p className="text-xs text-slate-400 mt-1">PDF only · Max 5MB</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="mt-3 w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors"
                        onClick={skipCvAndGoToJd}
                      >
                        Skip — I'll fill my profile manually →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Job Description */}
              {step === 3 && (
                <div className="animate-fade-in-up">
                  {props.jdAnalysis ? (
                    /* JD analyzed successfully */
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4">
                        <FileText size={20} className="text-emerald-400 shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-emerald-300">Job description analyzed!</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {props.jdAnalysis.title && `${props.jdAnalysis.title} · `}
                            {props.jdAnalysis.mustHaveSkills.length} must-have skills
                          </p>
                        </div>
                      </div>
                      {props.jdAnalysis.mustHaveSkills.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-400 mb-1.5">Must-have skills:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {props.jdAnalysis.mustHaveSkills.slice(0, 6).map((s) => (
                              <span key={s} className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 text-xs font-medium text-indigo-300">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* JD paste zone */
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Paste the job description
                      </label>
                      <textarea
                        className="w-full rounded-2xl custom-input px-5 py-3 text-sm text-ink shadow-sm placeholder:text-slate-400 focus:shadow-glow transition-shadow min-h-[140px] resize-none"
                        placeholder="Paste the full job description here. Include requirements, responsibilities, skills needed..."
                        value={jdText}
                        onChange={(e) => setJdText(e.target.value)}
                        autoFocus
                      />
                      <div className="flex items-center justify-between mt-3 gap-3">
                        <button
                          type="button"
                          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                          onClick={skipJdAndGoToReview}
                        >
                          Skip — No JD available →
                        </button>
                        <button
                          type="button"
                          className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all active:scale-[0.97] ${
                            jdText.trim().length >= 20 && !props.isAnalyzingJd
                              ? "bg-cyan-600 text-white hover:bg-cyan-500 shadow-glow-sm"
                              : "bg-slate-700 text-slate-400 cursor-not-allowed"
                          }`}
                          disabled={jdText.trim().length < 20 || props.isAnalyzingJd}
                          onClick={() => { props.onJdTextChange(jdText); props.onAnalyzeJd(jdText); }}
                        >
                          {props.isAnalyzingJd ? (
                            <>
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Analyzing...
                            </>
                          ) : (
                            <>
                              Analyze JD
                              <Sparkles size={14} />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Match Review */}
              {step === 4 && (
                <div className="animate-fade-in-up space-y-4">
                  {props.isMatching ? (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <svg className="animate-spin h-8 w-8 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <p className="text-sm text-slate-400">Matching your CV to the job...</p>
                    </div>
                  ) : props.cvJdMatch ? (
                    <>
                      {/* Match Score */}
                      <div className="flex justify-center py-2">{renderMatchScore()}</div>

                      {/* Matched Skills */}
                      {props.cvJdMatch.matchedSkills.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-emerald-400 mb-1.5">✅ Matched skills</p>
                          <div className="flex flex-wrap gap-1.5">
                            {props.cvJdMatch.matchedSkills.map((s) => (
                              <span key={s} className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-300">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Missing Skills */}
                      {props.cvJdMatch.missingSkills.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-rose-400 mb-1.5">⚠️ Gap skills</p>
                          <div className="flex flex-wrap gap-1.5">
                            {props.cvJdMatch.missingSkills.map((s) => (
                              <span key={s} className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 text-xs font-medium text-rose-300">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Focus Areas */}
                      {props.cvJdMatch.focusAreas.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-amber-400 mb-1.5">🎯 Interview focus areas</p>
                          <ul className="space-y-1">
                            {props.cvJdMatch.focusAreas.map((area, i) => (
                              <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                                <span className="text-amber-400 mt-0.5">•</span>
                                {area}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <p className="text-xs text-slate-500 text-center pt-2">Your interview will be tailored to highlight strengths and address gaps.</p>
                    </>
                  ) : props.cvAnalysis || props.jdAnalysis ? (
                    /* Partial data */
                    <div className="text-center py-4">
                      <p className="text-sm text-slate-400">
                        {props.cvAnalysis && !props.jdAnalysis
                          ? "You uploaded a CV. The interview will be tailored to your profile."
                          : props.jdAnalysis && !props.cvAnalysis
                          ? "You provided a JD. The interview will focus on those requirements."
                          : "Ready to start!"}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-slate-400">No CV or JD provided. You can still practice with a standard interview.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Role (from old step 2) */}
              {step === 5 && (
                <div className="animate-fade-in-up">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Target Role</label>
                  <select
                    className="w-full rounded-2xl custom-input px-5 py-3 text-base text-ink shadow-sm focus:shadow-glow transition-shadow appearance-none"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%2394a3b8' viewBox='0 0 16 16'%3E%3Cpath d='M1.5 5.5l6.5 6.5 6.5-6.5'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 1rem center",
                      paddingRight: "2.5rem",
                    }}
                    value={props.selectedRole}
                    onChange={(event) => props.onSelectedRoleChange(event.target.value)}
                    autoFocus
                  >
                    {predefinedRoles.map((role: string) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                    <option value={customRoleValue}>Other / Custom Role...</option>
                  </select>

                  {props.selectedRole === customRoleValue && (
                    <div className="mt-3 animate-fade-in">
                      <input
                        className="w-full rounded-2xl custom-input px-5 py-3 text-base text-ink shadow-sm placeholder:text-slate-400 focus:shadow-glow transition-shadow"
                        placeholder="e.g. Sales Operations Manager"
                        value={props.customRole}
                        onChange={(event) => props.onCustomRoleChange(event.target.value)}
                        autoFocus
                      />
                    </div>
                  )}

                  <div className="mt-4">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Interview Language</label>
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
              )}

              {/* Step 6: Experience (from old step 3) */}
              {step === 6 && (
                <div className="animate-fade-in-up">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Years of Experience</label>
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
                        className={`rounded-xl px-4 py-3 text-left transition-all ${
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
              )}

              {/* Error */}
              {props.errorMessage !== null && (
                <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-950/20 px-4 py-3 text-xs leading-6 text-rose-300 animate-shake" role="alert">
                  {props.errorMessage}
                </div>
              )}

              {/* Navigation */}
              <div className={`flex items-center justify-between gap-3 ${step === 1 ? "mt-5" : "mt-6"}`}>
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
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition-all active:scale-[0.97] ${
                    step === totalSteps
                      ? "bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-glow hover:shadow-glow-lg min-w-[180px]"
                      : "bg-cyan-600 text-white hover:bg-cyan-500 shadow-glow-sm"
                  } ${!validateStep(step) ? "opacity-50 cursor-not-allowed" : ""}`}
                  type="submit"
                  disabled={!validateStep(step)}
                >
                  {step === totalSteps ? (
                    <>Start Interview <ArrowRight size={16} className="animate-bounce-x" /></>
                  ) : step === 2 && !props.cvAnalysis && !props.isParsingCv ? (
                    <>Skip <ChevronRight size={16} /></>
                  ) : step === 3 && !props.jdAnalysis && !props.isAnalyzingJd ? (
                    <>Skip <ChevronRight size={16} /></>
                  ) : (
                    <>Continue <ChevronRight size={16} /></>
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
