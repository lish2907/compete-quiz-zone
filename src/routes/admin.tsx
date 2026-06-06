import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "@/components/qv/Navbar";
import { Footer } from "@/components/qv/Footer";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — QuizVerse" },
      { name: "description", content: "Host, monitor, and manage your live quizzes." },
    ],
  }),
  component: AdminDashboard,
});

const quizzes = [
  { code: "QV-4821", title: "World Capitals Rapid Round", players: 124, status: "Live" },
  { code: "QV-9931", title: "JS Trivia: Advanced Patterns", players: 38, status: "Lobby" },
  { code: "QV-1208", title: "Marketing 101 — Final Exam", players: 0, status: "Scheduled" },
];

const stats = [
  { label: "Active Quizzes", value: "12", tone: "primary" },
  { label: "Players Online", value: "2,481", tone: "secondary" },
  { label: "Avg. Accuracy", value: "78%", tone: "accent" },
  { label: "Completed Today", value: "164", tone: "primary" },
];

const leaderboard = [
  { rank: "01", name: "QuizWizard_99", pts: "12,450" },
  { rank: "02", name: "Alex_Dev", pts: "11,200" },
  { rank: "03", name: "HyperPlayer", pts: "9,840" },
  { rank: "04", name: "MintCondition", pts: "8,610" },
  { rank: "05", name: "Nova", pts: "7,920" },
];

function AdminDashboard() {
  return (
    <div className="min-h-screen mesh-gradient">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 pt-32 pb-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 animate-fade-in">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-primary mb-2">
              Admin Console
            </p>
            <h1 className="font-display text-5xl md:text-6xl tracking-tight">Mission Control</h1>
            <p className="text-foreground/60 mt-2 max-w-lg">
              Spin up new rooms, watch live leaderboards, and review post-game analytics.
            </p>
          </div>
          <Link
            to="/"
            className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-all text-center"
          >
            + New Quiz
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {stats.map((s) => (
            <div key={s.label} className="glass rounded-2xl p-6">
              <p className="text-xs font-mono uppercase tracking-widest text-foreground/50 mb-2">
                {s.label}
              </p>
              <p
                className={`font-display text-4xl tracking-tight ${
                  s.tone === "primary"
                    ? "text-primary"
                    : s.tone === "secondary"
                      ? "text-secondary"
                      : "text-accent"
                }`}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass rounded-3xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-mono text-sm uppercase tracking-widest text-foreground/50">
                Your Quizzes
              </h2>
              <span className="text-xs text-foreground/40">3 active rooms</span>
            </div>
            <div className="space-y-3">
              {quizzes.map((q) => (
                <div
                  key={q.code}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-foreground/5 border border-border rounded-xl hover:border-primary/40 transition-colors"
                >
                  <div>
                    <p className="font-mono text-xs text-primary tracking-widest">{q.code}</p>
                    <p className="font-bold mt-1">{q.title}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-sm text-secondary">{q.players} players</span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border ${
                        q.status === "Live"
                          ? "text-primary border-primary/30 bg-primary/10"
                          : q.status === "Lobby"
                            ? "text-secondary border-secondary/30 bg-secondary/10"
                            : "text-foreground/50 border-border bg-foreground/5"
                      }`}
                    >
                      {q.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-3xl p-6 animate-float">
            <h2 className="font-mono text-sm uppercase tracking-widest text-foreground/50 mb-6">
              Live Leaderboard
            </h2>
            <div className="space-y-3">
              {leaderboard.map((r, i) => (
                <div
                  key={r.rank}
                  className={`flex items-center justify-between p-3 rounded-xl border ${
                    i === 0 ? "bg-primary/10 border-primary/30" : "bg-foreground/5 border-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-primary text-sm">{r.rank}</span>
                    <span className="font-bold text-sm">{r.name}</span>
                  </div>
                  <span className="font-mono text-xs text-secondary">{r.pts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}