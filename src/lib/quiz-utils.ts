export const OPTIONS = ["A", "B", "C", "D"] as const;
export type OptionKey = (typeof OPTIONS)[number];

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export type QuizStatus = "draft" | "waiting" | "live" | "paused" | "ended";

export const STATUS_TONE: Record<QuizStatus, string> = {
  draft: "bg-foreground/10 text-foreground/70 border-border",
  waiting: "bg-secondary/15 text-secondary border-secondary/30",
  live: "bg-primary/15 text-primary border-primary/30",
  paused: "bg-accent/15 text-accent border-accent/30",
  ended: "bg-foreground/5 text-foreground/50 border-border",
};
