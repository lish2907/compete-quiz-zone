import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell, AuthInput, AuthButton } from "@/components/qv/AuthShell";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — QuizVerse" },
      { name: "description", content: "Log in to host or join quizzes on QuizVerse." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"admin" | "participant">("admin");

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to continue your QuizVerse journey."
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="text-primary font-semibold hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2 p-1 bg-foreground/5 border border-border rounded-xl mb-6">
        {(["admin", "participant"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`py-2 text-xs font-mono uppercase tracking-widest rounded-lg transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ to: tab === "admin" ? "/admin" : "/join" });
        }}
      >
        <AuthInput label="Email" type="email" placeholder="you@quizverse.app" required />
        <AuthInput label="Password" type="password" placeholder="••••••••" required />
        <AuthButton type="submit">
          {tab === "admin" ? "Enter Admin Console" : "Continue to Lobby"}
        </AuthButton>
      </form>
    </AuthShell>
  );
}