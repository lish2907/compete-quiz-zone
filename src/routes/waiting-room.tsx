import { createFileRoute, Link } from "@tanstack/react-router";
import { ProgressSteps } from "@/components/qv/ProgressSteps";

export const Route = createFileRoute("/waiting-room")({
  head: () => ({
    meta: [
      { title: "Waiting Room — QuizVerse" },
      { name: "description", content: "Waiting for the host to start the quiz." },
    ],
  }),
  component: WaitingRoomPage,
});

function WaitingRoomPage() {
  return (
    <div className="min-h-screen mesh-gradient flex items-center justify-center px-6 py-12 relative overflow-hidden">
      <div className="absolute -z-10 top-1/3 left-1/4 size-96 bg-primary/20 blur-[120px] rounded-full" />
      <div className="absolute -z-10 bottom-1/4 right-1/4 size-96 bg-secondary/20 blur-[120px] rounded-full" />
      <div className="w-full max-w-lg">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="size-8 bg-primary rounded-lg flex items-center justify-center font-bold text-primary-foreground">
            Q
          </div>
          <span className="font-display text-2xl tracking-wider">QUIZVERSE</span>
        </Link>
        <div className="glass rounded-3xl p-8 shadow-2xl animate-fade-in text-center">
          <ProgressSteps current={2} />
          <div className="size-20 mx-auto rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center mb-6">
            <div className="size-10 rounded-full bg-primary animate-pulse" />
          </div>
          <h1 className="font-display text-4xl tracking-tight mb-2">You're in!</h1>
          <p className="text-foreground/60 text-sm mb-6">
            Hang tight — the host will start the quiz soon. Keep this tab open.
          </p>
          <div className="text-xs font-mono uppercase tracking-widest text-foreground/40">
            Waiting for host…
          </div>
        </div>
      </div>
    </div>
  );
}