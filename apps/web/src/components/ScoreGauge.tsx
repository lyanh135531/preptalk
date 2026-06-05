import { useEffect, useState } from "react";

type ScoreGaugeProps = {
  readonly label: string;
  readonly value: number;
};

export const ScoreGauge = ({ label, value }: ScoreGaugeProps) => {
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    // Trigger smooth transition on mount
    const timer = setTimeout(() => {
      setAnimatedValue(value);
    }, 150);
    return () => clearTimeout(timer);
  }, [value]);

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedValue / 100) * circumference;

  // Determine color theme based on score value
  let strokeColor = "stroke-cyan-650";
  let textColor = "text-cyan-400";
  let bgColor = "text-cyan-950/40";
  
  if (value >= 80) {
    strokeColor = "stroke-emerald-500";
    textColor = "text-emerald-400";
    bgColor = "text-emerald-950/20";
  } else if (value < 50) {
    strokeColor = "stroke-rose-500";
    textColor = "text-rose-400";
    bgColor = "text-rose-950/20";
  } else if (value < 70) {
    strokeColor = "stroke-amber-500";
    textColor = "text-amber-400";
    bgColor = "text-amber-950/20";
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-slate-900/40 border border-line p-4 transition-all duration-300 hover:border-slate-700 hover:shadow-md">
      <div className="relative size-24">
        {/* Track Circle */}
        <svg className="size-full -rotate-90" viewBox="0 0 100 100">
          <circle
            className={`stroke-current ${bgColor}`}
            strokeWidth="8"
            fill="transparent"
            r={radius}
            cx="50"
            cy="50"
          />
          {/* Animated Value Circle */}
          <circle
            className={`transition-all duration-1000 ease-out ${strokeColor}`}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            r={radius}
            cx="50"
            cy="50"
          />
        </svg>
        {/* Percentage Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-xl font-bold tracking-tight ${textColor}`}>
            {value}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            / 100
          </span>
        </div>
      </div>
      <span className="mt-3 text-xs font-semibold text-slate-300 text-center tracking-wide">
        {label}
      </span>
    </div>
  );
};
