/* Skeleton loading placeholders */

export const SkeletonBlock = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-lg bg-slate-800/60 ${className}`} />
);

export const FeedbackSkeleton = () => (
  <div className="space-y-6 animate-fade-in-up">
    {/* Answer comparison skeleton */}
    <section className="rounded-2xl border border-line bg-panel/60 p-5 shadow-soft backdrop-blur-md glass-panel">
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <div>
          <SkeletonBlock className="h-4 w-24 mb-3" />
          <SkeletonBlock className="h-28 w-full" />
        </div>
        <div>
          <SkeletonBlock className="h-4 w-32 mb-3" />
          <SkeletonBlock className="h-28 w-full" />
        </div>
      </div>
    </section>

    {/* Scores skeleton */}
    <section className="rounded-2xl border border-line bg-panel/60 p-5 backdrop-blur-md glass-panel">
      <SkeletonBlock className="h-4 w-28 mb-4" />
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center rounded-xl bg-slate-900/40 border border-line p-4">
            <SkeletonBlock className="size-24 rounded-full" />
            <SkeletonBlock className="h-3 w-16 mt-3" />
          </div>
        ))}
      </div>
    </section>

    {/* Feedback lists skeleton */}
    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-line bg-panel/40 p-5">
          <SkeletonBlock className="h-4 w-32 mb-3" />
          <div className="space-y-2">
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-4/5" />
            <SkeletonBlock className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const ScoreGaugeSkeleton = () => (
  <div className="flex flex-col items-center justify-center rounded-xl bg-slate-900/40 border border-line p-4">
    <div className="relative size-24">
      <div className="size-full rounded-full border-4 border-slate-800/60 animate-pulse" />
    </div>
    <SkeletonBlock className="h-3 w-16 mt-3" />
  </div>
);
