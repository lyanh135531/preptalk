import type { ReactNode } from "react";
import { CheckCircle2, ChevronLeft, Headphones, Mic, ShieldAlert } from "lucide-react";

type WorkStatus = "idle" | "starting" | "playing" | "suggesting" | "recording" | "submitting";

type ReadinessScreenProps = {
  readonly errorMessage: string | null;
  readonly noticeMessage: string | null;
  readonly workStatus: WorkStatus;
  readonly onBack: () => void;
  readonly onConfirm: () => Promise<void>;
};

export const ReadinessScreen = (props: ReadinessScreenProps) => (
  <section className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-8">
    <div className="w-full rounded-2xl border border-line bg-panel/75 p-6 shadow-soft sm:p-8 backdrop-blur-md glass-panel">
      <div className="flex items-center gap-4">
        <div className="relative flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-600 to-indigo-650 text-white shadow-glow">
          <Headphones size={24} aria-hidden="true" />
          <span className="absolute -inset-1 animate-ping rounded-xl bg-cyan-500/10 opacity-75" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">Ready Check</p>
          <h2 className="text-2xl font-bold font-display text-ink">Get ready to listen & speak</h2>
        </div>
      </div>

      <div className="mt-8 grid gap-4 grid-cols-1 sm:grid-cols-3">
        <ReadinessItem 
          icon={<Headphones className="text-cyan-400" size={18} />}
          title="Headphones" 
          text="Use headphones to prevent microphone echo for the best experience." 
        />
        <ReadinessItem 
          icon={<Mic className="text-indigo-400" size={18} />}
          title="Microphone" 
          text="Grant browser permission to access your microphone when prompted." 
        />
        <ReadinessItem 
          icon={<ShieldAlert className="text-emerald-400" size={18} />}
          title="Compatibility" 
          text="Chrome or Edge is highly recommended for stable voice transcription." 
        />
      </div>

      {props.errorMessage !== null ? (
        <div className="mt-6 rounded-xl border border-rose-500/20 bg-rose-950/20 px-4 py-3 text-xs leading-6 text-rose-300">
          {props.errorMessage}
        </div>
      ) : null}

      {props.noticeMessage !== null ? (
        <div className="mt-6 rounded-xl border border-cyan-500/20 bg-cyan-950/20 px-4 py-3 text-xs leading-6 text-cyan-300">
          {props.noticeMessage}
        </div>
      ) : null}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end border-t border-line/50 pt-5">
        <button 
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition active:scale-[0.98]" 
          type="button" 
          onClick={props.onBack}
        >
          <ChevronLeft size={16} />
          Back
        </button>
        <button
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-cyan-650 px-6 py-3 text-sm font-bold text-white hover:bg-cyan-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:opacity-50 transition shadow-glow"
          type="button"
          disabled={props.workStatus === "starting"}
          onClick={props.onConfirm}
        >
          {props.workStatus === "starting" ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Preparing AI Room...</span>
            </>
          ) : (
            <>
              <span>I am ready</span>
              <CheckCircle2 size={16} aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </div>
  </section>
);

type ReadinessItemProps = {
  readonly icon: ReactNode;
  readonly title: string;
  readonly text: string;
};

const ReadinessItem = ({ icon, title, text }: ReadinessItemProps) => (
  <div className="rounded-xl border border-line bg-slate-950/40 p-4 transition-all hover:border-slate-700">
    <div className="flex items-center gap-2 mb-2.5">
      {icon}
      <p className="font-bold text-sm text-ink font-display">{title}</p>
    </div>
    <p className="text-xs leading-5 text-slate-400">{text}</p>
  </div>
);
