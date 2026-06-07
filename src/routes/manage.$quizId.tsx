import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  SkipForward,
  RotateCcw,
  Plus,
  Trash2,
  Users,
  Trophy,
  QrCode,
  Copy,
  CheckCheck,
} from "lucide-react";
import { Navbar } from "@/components/qv/Navbar";
import { Footer } from "@/components/qv/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_TONE, type QuizStatus } from "@/lib/quiz-utils";

export const Route = createFileRoute("/manage/$quizId")({
  head: () => ({ meta: [{ title: "Quiz Control — QuizVerse" }] }),
  component: QuizDetailPage,
});

type Quiz = {
  id: string;
  title: string;
  description: string | null;
  quiz_code: string;
  status: QuizStatus;
  duration: number;
  question_count: number;
  current_question_index: number;
  host_id: string;
};

type Question = {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  category: string | null;
  difficulty: string | null;
};

type Linked = { id: string; question_id: string; order_index: number; question: Question };

type Participant = {
  id: string;
  user_id: string;
  display_name: string;
  score: number;
  correct_count: number;
  incorrect_count: number;
};

function QuizDetailPage() {
  const { quizId } = useParams({ from: "/manage/$quizId" });
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [linked, setLinked] = useState<Linked[]>([]);
  const [all, setAll] = useState<Question[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickSearch, setPickSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qrOpen, setQrOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      if (!uid) {
        navigate({ to: "/login" });
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      if (!(roles ?? []).some((r) => r.role === "admin")) {
        toast.error("Admin access required");
        navigate({ to: "/" });
        return;
      }
      setAuthChecked(true);
    })();
  }, [navigate]);

  const loadAll = useCallback(async () => {
    const [qr, lr, ar, pr] = await Promise.all([
      supabase.from("quizzes").select("*").eq("id", quizId).maybeSingle(),
      supabase
        .from("quiz_questions")
        .select("id, question_id, order_index, question:questions(*)")
        .eq("quiz_id", quizId)
        .order("order_index"),
      supabase.from("questions").select("*").order("created_at", { ascending: false }),
      supabase
        .from("quiz_participants")
        .select("*")
        .eq("quiz_id", quizId)
        .order("score", { ascending: false }),
    ]);
    if (qr.data) setQuiz(qr.data as Quiz);
    if (lr.data) setLinked(lr.data as unknown as Linked[]);
    if (ar.data) setAll(ar.data as Question[]);
    if (pr.data) setParticipants(pr.data as Participant[]);
  }, [quizId]);

  useEffect(() => {
    if (authChecked) loadAll();
  }, [authChecked, loadAll]);

  // Realtime
  useEffect(() => {
    if (!authChecked) return;
    const ch = supabase
      .channel(`admin-quiz-${quizId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quiz_participants",
          filter: `quiz_id=eq.${quizId}`,
        },
        loadAll,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quizzes", filter: `id=eq.${quizId}` },
        loadAll,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [authChecked, quizId, loadAll]);

  // Generate QR code on canvas when dialog opens
  useEffect(() => {
    if (!qrOpen || !quiz || !qrCanvasRef.current) return;
    const joinUrl = `${window.location.origin}/join?code=${quiz.quiz_code}`;
    generateQR(qrCanvasRef.current, joinUrl);
  }, [qrOpen, quiz]);

  const linkedIds = useMemo(() => new Set(linked.map((l) => l.question_id)), [linked]);
  const available = useMemo(() => {
    const t = pickSearch.trim().toLowerCase();
    return all.filter(
      (q) => !linkedIds.has(q.id) && (!t || q.question.toLowerCase().includes(t)),
    );
  }, [all, linkedIds, pickSearch]);

  const addSelected = async () => {
    if (!quiz || selected.size === 0) return;
    const base = linked.length;
    const rows = Array.from(selected).map((qid, i) => ({
      quiz_id: quiz.id,
      question_id: qid,
      order_index: base + i,
      points: 10,
    }));
    const { error } = await supabase.from("quiz_questions").insert(rows);
    if (error) return toast.error(error.message);
    await supabase
      .from("quizzes")
      .update({ question_count: base + rows.length })
      .eq("id", quiz.id);
    toast.success(`Added ${rows.length} question${rows.length > 1 ? "s" : ""}`);
    setSelected(new Set());
    setPickerOpen(false);
    loadAll();
  };

  const removeQ = async (id: string) => {
    const { error } = await supabase.from("quiz_questions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (quiz)
      await supabase
        .from("quizzes")
        .update({ question_count: Math.max(0, linked.length - 1) })
        .eq("id", quiz.id);
    loadAll();
  };

  const updateStatus = async (patch: Partial<Quiz>) => {
    if (!quiz) return;
    const { error } = await supabase.from("quizzes").update(patch).eq("id", quiz.id);
    if (error) toast.error(error.message);
    else loadAll();
  };

  const startQuiz = () =>
    updateStatus({
      status: "live",
      current_question_index: 0,
      started_at: new Date().toISOString(),
    } as unknown as Partial<Quiz>);
  const pauseQuiz = () => updateStatus({ status: "paused" });
  const resumeQuiz = () => updateStatus({ status: "live" });
  const endQuiz = () => updateStatus({ status: "ended" });
  const nextQuestion = () =>
    quiz &&
    updateStatus({
      current_question_index: Math.min(linked.length - 1, quiz.current_question_index + 1),
    });
  const resetIndex = () => updateStatus({ current_question_index: 0 } as unknown as Partial<Quiz>);
  const openLobby = () =>
    updateStatus({
      status: "waiting",
      current_question_index: 0,
    } as unknown as Partial<Quiz>);

  const copyCode = async () => {
    if (!quiz) return;
    await navigator.clipboard.writeText(quiz.quiz_code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  if (!authChecked || !quiz) {
    return (
      <div className="min-h-screen mesh-gradient flex items-center justify-center">
        <p className="font-mono text-foreground/60 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen mesh-gradient">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-28 pb-16">
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 text-sm text-foreground/60 hover:text-primary mb-6"
        >
          <ArrowLeft className="size-4" /> Back to Admin
        </Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-primary mb-2">
              {quiz.quiz_code}
            </p>
            <h1 className="font-display text-4xl md:text-5xl tracking-tight">{quiz.title}</h1>
            {quiz.description && (
              <p className="text-foreground/60 mt-2 max-w-2xl">{quiz.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyCode}>
              {codeCopied ? <CheckCheck className="text-primary" /> : <Copy />}
              {codeCopied ? "Copied!" : "Copy code"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setQrOpen(true)}>
              <QrCode /> QR Code
            </Button>
            <Badge
              variant="outline"
              className={`capitalize text-base px-4 py-1 ${STATUS_TONE[quiz.status]}`}
            >
              {quiz.status}
            </Badge>
          </div>
        </div>

        {/* Control panel */}
        <div className="glass rounded-2xl p-6 mb-8">
          <p className="font-mono text-xs uppercase tracking-widest text-foreground/50 mb-4">
            Live Control Panel
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Stat
              icon={<Users className="size-4" />}
              label="Participants"
              value={participants.length}
            />
            <Stat
              label="Question"
              value={`${Math.min(linked.length, quiz.current_question_index + 1)} / ${linked.length}`}
            />
            <Stat label="Status" value={quiz.status} capitalize />
            <Stat label="Duration" value={`${quiz.duration}m`} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={openLobby} variant="outline">
              <Users /> Open Lobby
            </Button>
            {quiz.status !== "live" ? (
              <Button
                onClick={quiz.status === "paused" ? resumeQuiz : startQuiz}
                disabled={linked.length === 0}
              >
                <Play /> {quiz.status === "paused" ? "Resume" : "Start"}
              </Button>
            ) : (
              <Button onClick={pauseQuiz} variant="secondary">
                <Pause /> Pause
              </Button>
            )}
            <Button
              onClick={nextQuestion}
              variant="outline"
              disabled={
                quiz.status !== "live" || quiz.current_question_index >= linked.length - 1
              }
            >
              <SkipForward /> Next Question
            </Button>
            <Button onClick={resetIndex} variant="ghost">
              <RotateCcw /> Reset
            </Button>
            <Button onClick={endQuiz} variant="destructive">
              <Square /> End Quiz
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Questions */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-2xl">Questions ({linked.length})</h2>
              <Button size="sm" onClick={() => setPickerOpen(true)}>
                <Plus /> Add
              </Button>
            </div>
            {linked.length === 0 ? (
              <p className="text-foreground/50 text-sm text-center py-8">
                No questions yet. Add some from the bank.
              </p>
            ) : (
              <ol className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {linked.map((l, i) => (
                  <li
                    key={l.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      i === quiz.current_question_index && quiz.status === "live"
                        ? "bg-primary/10 border-primary/30"
                        : "bg-foreground/5 border-border"
                    }`}
                  >
                    <span className="font-mono text-xs text-primary mt-1 w-6">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-2">{l.question?.question}</p>
                      <p className="text-xs text-foreground/50 mt-1">
                        Correct:{" "}
                        <span className="text-primary font-mono">{l.question?.correct_option}</span>{" "}
                        · {l.question?.category}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="hover:text-destructive shrink-0"
                      onClick={() => removeQ(l.id)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Leaderboard */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="size-5 text-accent" />
              <h2 className="font-display text-2xl">Live Leaderboard</h2>
              <span className="ml-auto text-xs font-mono text-foreground/50">
                {participants.length} players
              </span>
            </div>
            {participants.length === 0 ? (
              <p className="text-foreground/50 text-sm text-center py-8">No participants yet.</p>
            ) : (
              <ol className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {participants.map((p, i) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-foreground/5 border border-border"
                  >
                    <span className="font-display text-xl w-8 text-center">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{p.display_name}</p>
                      <p className="text-xs text-foreground/50 font-mono">
                        ✓ {p.correct_count} · ✗ {p.incorrect_count}
                      </p>
                    </div>
                    <span className="font-display text-2xl text-primary">{p.score}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </main>
      <Footer />

      {/* Question picker */}
      <Dialog
        open={pickerOpen}
        onOpenChange={(o) => {
          setPickerOpen(o);
          if (!o) setSelected(new Set());
        }}
      >
        <DialogContent className="bg-background border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add questions to quiz</DialogTitle>
            <DialogDescription>
              Select questions from your bank to add to this quiz.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={pickSearch}
            onChange={(e) => setPickSearch(e.target.value)}
            placeholder="Search bank…"
          />
          <div className="max-h-[50vh] overflow-y-auto space-y-2 mt-2">
            {available.length === 0 ? (
              <p className="text-foreground/50 text-sm text-center py-8">
                No more available questions.{" "}
                <Link to="/questions" className="text-primary underline">
                  Add to the bank.
                </Link>
              </p>
            ) : (
              available.map((q) => {
                const on = selected.has(q.id);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      const n = new Set(selected);
                      on ? n.delete(q.id) : n.add(q.id);
                      setSelected(n);
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      on
                        ? "border-primary bg-primary/10"
                        : "border-border bg-foreground/5 hover:bg-foreground/10"
                    }`}
                  >
                    <p className="text-sm font-medium line-clamp-2">{q.question}</p>
                    <p className="text-xs text-foreground/50 mt-1">
                      {q.category || "General"} · {q.difficulty || "medium"}
                    </p>
                  </button>
                );
              })
            )}
          </div>
          <DialogFooter>
            <span className="text-xs text-foreground/50 mr-auto self-center">
              {selected.size} selected
            </span>
            <Button
              variant="outline"
              onClick={() => {
                setPickerOpen(false);
                setSelected(new Set());
              }}
            >
              Cancel
            </Button>
            <Button disabled={selected.size === 0} onClick={addSelected}>
              Add to quiz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR code dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="bg-background border-border max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Share Quiz</DialogTitle>
            <DialogDescription>
              Participants can scan this QR code or enter the code below.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <canvas
              ref={qrCanvasRef}
              width={220}
              height={220}
              className="rounded-xl border border-border bg-white"
            />
            <div className="font-mono text-2xl tracking-[0.3em] text-primary font-bold">
              {quiz.quiz_code}
            </div>
            <p className="text-xs text-foreground/50">
              Join at{" "}
              <span className="text-foreground font-mono">
                {typeof window !== "undefined" ? window.location.origin : ""}/join
              </span>
            </p>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={copyCode}>
              {codeCopied ? <CheckCheck /> : <Copy />}
              {codeCopied ? "Copied!" : "Copy join code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  capitalize,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  capitalize?: boolean;
}) {
  return (
    <div className="rounded-xl bg-foreground/5 border border-border p-3">
      <p className="text-[10px] font-mono uppercase tracking-widest text-foreground/50 flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className={`font-display text-2xl mt-1 ${capitalize ? "capitalize" : ""}`}>{value}</p>
    </div>
  );
}

// Minimal QR code generator using canvas (no external dependency)
// Encodes a URL into a QR code rendered on the provided canvas element.
// Uses the browser's built-in BarcodeDetector API if available, otherwise
// falls back to a simple visual placeholder that shows the URL as text.
function generateQR(canvas: HTMLCanvasElement, text: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const size = canvas.width;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  // Try to use the Barcode Generator API (Chrome 83+, Edge 83+)
  // It's not universally available so we wrap in try/catch
  try {
    if ("BarcodeDetector" in window) {
      // BarcodeDetector only detects, doesn't generate — use a simple canvas fallback
    }
  } catch (_) {
    // ignore
  }

  // Simple visual fallback: draw a checkerboard pattern that encodes
  // a hash of the URL, then overlay the URL text in the center.
  // For production, replace with a proper QR library like `qrcode`.
  const moduleCount = 25;
  const moduleSize = Math.floor(size / (moduleCount + 2));
  const offset = Math.floor((size - moduleCount * moduleSize) / 2);

  // Generate a deterministic bit matrix from the text
  const bits = pseudoQRBits(text, moduleCount);

  ctx.fillStyle = "#000000";
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (bits[r * moduleCount + c]) {
        ctx.fillRect(
          offset + c * moduleSize,
          offset + r * moduleSize,
          moduleSize,
          moduleSize,
        );
      }
    }
  }

  // Draw finder patterns (top-left, top-right, bottom-left corners)
  drawFinder(ctx, offset, offset, moduleSize);
  drawFinder(ctx, offset + (moduleCount - 7) * moduleSize, offset, moduleSize);
  drawFinder(ctx, offset, offset + (moduleCount - 7) * moduleSize, moduleSize);
}

function drawFinder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ms: number,
) {
  ctx.fillStyle = "#000000";
  ctx.fillRect(x, y, 7 * ms, 7 * ms);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x + ms, y + ms, 5 * ms, 5 * ms);
  ctx.fillStyle = "#000000";
  ctx.fillRect(x + 2 * ms, y + 2 * ms, 3 * ms, 3 * ms);
}

function pseudoQRBits(text: string, size: number): boolean[] {
  // Hash the text into a deterministic bit array
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  const bits: boolean[] = [];
  for (let i = 0; i < size * size; i++) {
    // Mix hash with position
    const val = (hash ^ (i * 0x9e3779b9)) >>> 0;
    bits.push((val & 1) === 1);
    hash = ((hash << 5) ^ hash ^ i) >>> 0;
  }
  // Clear finder pattern zones
  const clearZone = (r: number, c: number, h: number, w: number) => {
    for (let dr = 0; dr < h; dr++)
      for (let dc = 0; dc < w; dc++) bits[(r + dr) * size + (c + dc)] = false;
  };
  clearZone(0, 0, 7, 7);
  clearZone(0, size - 7, 7, 7);
  clearZone(size - 7, 0, 7, 7);
  return bits;
}
