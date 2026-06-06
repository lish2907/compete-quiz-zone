import { createFileRoute } from "@tanstack/react-router";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Navbar } from "@/components/qv/Navbar";
import { Footer } from "@/components/qv/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QuizVerse — Compete. Learn. Win." },
      { name: "description", content: "Real-time quiz platform. Join a quiz with a code and compete on a live leaderboard." },
      { property: "og:title", content: "QuizVerse — Compete. Learn. Win." },
      { property: "og:description", content: "Real-time quiz platform. Join a quiz with a code and compete on a live leaderboard." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  const onJoin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/join", search: { code: code || undefined } as never });
  };

  return (
    <div className="min-h-screen mesh-gradient text-foreground overflow-x-hidden">
      <Navbar />

      {/* Hero */}
      <main className="relative pt-32 pb-20 px-6">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 select-none pointer-events-none opacity-[0.04] whitespace-nowrap">
          <h1 className="font-display text-[24vw] leading-none tracking-tighter">QUIZVERSE</h1>
        </div>

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative z-10 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              LIVE: 12,402 ACTIVE PLAYERS
            </div>
            <h2 className="font-display text-6xl md:text-8xl leading-[0.9] tracking-tight mb-6">
              COMPETE.<br />LEARN.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                WIN.
              </span>
            </h2>
            <p className="max-w-md text-foreground/60 text-lg mb-10">
              The high-velocity trivia engine built for classrooms, boardrooms, and living rooms.
              Join a game in seconds.
            </p>

            <form
              onSubmit={onJoin}
              className="flex flex-col sm:flex-row gap-3 p-2 glass rounded-2xl"
            >
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-foreground/30 text-xs">
                  CODE
                </span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  type="text"
                  placeholder="000-000"
                  className="w-full bg-transparent py-4 pl-16 pr-4 font-mono text-xl tracking-[0.2em] uppercase outline-none text-foreground placeholder:text-foreground/20"
                />
              </div>
              <button
                type="submit"
                className="px-8 py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-all shadow-lg shadow-primary/20 active:scale-95"
              >
                JOIN QUIZ
              </button>
              <Link
                to="/login"
                className="px-8 py-4 bg-foreground/10 hover:bg-foreground/20 text-foreground font-bold rounded-xl transition-all border border-border active:scale-95 text-center"
              >
                HOST QUIZ
              </Link>
            </form>
          </div>

          {/* Leaderboard mock */}
          <div className="relative animate-slide-up [animation-delay:200ms]">
            <div className="relative glass rounded-3xl p-6 overflow-hidden animate-float shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-mono text-sm uppercase tracking-widest text-foreground/50">
                  Live Standings
                </h3>
                <div className="px-3 py-1 bg-secondary/10 border border-secondary/20 rounded text-[10px] text-secondary font-mono">
                  TRIVIA_MASTERS_v4
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { rank: "01", name: "QuizWizard_99", pts: "12,450", hl: false },
                  { rank: "02", name: "Alex_Dev", pts: "11,200", hl: true },
                  { rank: "03", name: "HyperPlayer", pts: "9,840", hl: false, dim: true },
                ].map((row) => (
                  <div
                    key={row.rank}
                    className={`flex items-center justify-between p-4 rounded-xl border ${
                      row.hl
                        ? "bg-foreground/10 border-primary/30"
                        : "bg-foreground/5 border-border"
                    } ${row.dim ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-4">
                      <span className={`font-mono ${row.dim ? "text-foreground/40" : "text-primary"}`}>
                        {row.rank}
                      </span>
                      <span className="font-bold">{row.name}</span>
                    </div>
                    <span className={`font-mono ${row.dim ? "text-foreground/40" : "text-secondary"}`}>
                      {row.pts} pts
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-border">
                <div className="w-full h-24 bg-foreground/5 rounded-lg grid place-items-center">
                  <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-foreground/30">
                    Real-time Analytics Feed
                  </span>
                </div>
              </div>
            </div>

            <div className="absolute -z-10 -top-20 -right-20 size-64 bg-primary/20 blur-[100px] rounded-full" />
            <div className="absolute -z-10 -bottom-20 -left-20 size-64 bg-secondary/20 blur-[100px] rounded-full" />
          </div>
        </div>
      </main>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              title: "Low Latency Sync",
              body: "Proprietary WebSocket engine ensures sub-50ms synchronization for global competitive play.",
              color: "primary",
              shape: "rounded-sm",
            },
            {
              title: "Advanced Analytics",
              body: "Deep-dive into performance metrics, question difficulty heatmaps, and participant engagement.",
              color: "secondary",
              shape: "rounded-sm rotate-45",
            },
            {
              title: "Custom Branding",
              body: "Deploy white-labeled quizzes with your colors, logos, and custom transition effects.",
              color: "accent",
              shape: "rounded-full",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="p-8 glass rounded-3xl group hover:border-primary/50 transition-colors"
            >
              <div
                className={`size-12 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${
                  f.color === "primary"
                    ? "bg-primary/20"
                    : f.color === "secondary"
                      ? "bg-secondary/20"
                      : "bg-accent/20"
                }`}
              >
                <div
                  className={`size-4 ${f.shape} ${
                    f.color === "primary"
                      ? "bg-primary"
                      : f.color === "secondary"
                        ? "bg-secondary"
                        : "bg-accent"
                  }`}
                />
              </div>
              <h4 className="text-xl font-bold mb-3">{f.title}</h4>
              <p className="text-sm text-foreground/50 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
