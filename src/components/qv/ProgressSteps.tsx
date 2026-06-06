export function ProgressSteps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Register", "Waiting Room", "Quiz Live"];
  return (
    <ol className="flex items-center justify-between gap-2 mb-8">
      {steps.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3;
        const active = step === current;
        const done = step < current;
        return (
          <li key={label} className="flex items-center gap-2 flex-1">
            <div
              className={`size-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                done
                  ? "bg-primary text-primary-foreground border-primary"
                  : active
                    ? "bg-primary/20 text-primary border-primary"
                    : "bg-foreground/5 text-foreground/40 border-border"
              }`}
            >
              {done ? "✓" : step}
            </div>
            <span
              className={`text-xs font-mono uppercase tracking-widest ${
                active ? "text-foreground" : "text-foreground/40"
              }`}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <div className="flex-1 h-px bg-border mx-2" />
            )}
          </li>
        );
      })}
    </ol>
  );
}