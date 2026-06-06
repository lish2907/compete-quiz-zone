import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen mesh-gradient flex items-center justify-center px-6 py-12 relative overflow-hidden">
      <div className="absolute -z-10 top-1/3 left-1/4 size-96 bg-primary/20 blur-[120px] rounded-full" />
      <div className="absolute -z-10 bottom-1/4 right-1/4 size-96 bg-secondary/20 blur-[120px] rounded-full" />

      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="size-8 bg-primary rounded-lg flex items-center justify-center font-bold text-primary-foreground">
            Q
          </div>
          <span className="font-display text-2xl tracking-wider">QUIZVERSE</span>
        </Link>

        <div className="glass rounded-3xl p-8 shadow-2xl animate-fade-in">
          <h1 className="font-display text-4xl tracking-tight mb-2">{title}</h1>
          <p className="text-foreground/60 text-sm mb-8">{subtitle}</p>
          {children}
        </div>

        {footer && (
          <div className="text-center text-sm text-foreground/60 mt-6">{footer}</div>
        )}
      </div>
    </div>
  );
}

export function AuthInput({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block mb-4">
      <span className="block text-xs font-mono uppercase tracking-widest text-foreground/50 mb-2">
        {label}
      </span>
      <input
        {...props}
        className="w-full bg-foreground/5 border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary/50 focus:bg-foreground/10 transition-colors"
      />
    </label>
  );
}

export function AuthButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="w-full py-3.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-all shadow-lg shadow-primary/20 active:scale-[0.98] mt-2"
    >
      {children}
    </button>
  );
}