import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell, AuthInput, AuthButton } from "@/components/qv/AuthShell";

export const Route = createFileRoute("/join")({
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s.code === "string" ? s.code : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Join Quiz — QuizVerse" },
      { name: "description", content: "Enter a quiz code to join a live QuizVerse session." },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const navigate = useNavigate();
  const { code: initial } = Route.useSearch();
  const [code, setCode] = useState(initial ?? "");
  const [name, setName] = useState("");

  return (
    <AuthShell
      title="Join a quiz"
      subtitle="Enter the code your host shared with you to drop into the lobby."
      footer={
        <>
          Hosting instead?{" "}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Log in as admin
          </Link>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ to: "/admin" });
        }}
      >
        <label className="block mb-4">
          <span className="block text-xs font-mono uppercase tracking-widest text-foreground/50 mb-2">
            Quiz code
          </span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="000-000"
            required
            className="w-full bg-foreground/5 border border-border rounded-xl px-4 py-4 font-mono text-2xl tracking-[0.3em] uppercase text-center text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-primary/50 focus:bg-foreground/10 transition-colors"
          />
        </label>
        <AuthInput
          label="Display name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Player One"
          required
        />
        <AuthButton type="submit">Enter Lobby</AuthButton>
      </form>
    </AuthShell>
  );
}