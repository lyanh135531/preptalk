import { useEffect, useState } from "react";

export const AudioVisualizer = () => {
  const [heights, setHeights] = useState<number[]>([20, 30, 40, 30, 20]);

  // Optionally generate mock real-time movement to look even more alive!
  useEffect(() => {
    const interval = setInterval(() => {
      setHeights(
        Array.from({ length: 15 }, () => Math.floor(Math.random() * 35) + 10)
      );
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-center gap-1.5 h-16 w-full rounded-xl bg-slate-950/60 border border-line p-4">
      {heights.map((height, i) => {
        // Distribute animation speeds for natural feel
        let animClass = "animate-wave-bar";
        if (i % 3 === 0) animClass = "animate-wave-bar-fast";
        if (i % 3 === 2) animClass = "animate-wave-bar-slow";

        return (
          <span
            key={i}
            className={`w-1.5 bg-gradient-to-t from-cyan-650 to-indigo-400 rounded-full ${animClass}`}
            style={{
              height: `${height}px`,
              animationDelay: `${String(i * 0.1)}s`,
              transformOrigin: "bottom",
            }}
          />
        );
      })}
    </div>
  );
};
