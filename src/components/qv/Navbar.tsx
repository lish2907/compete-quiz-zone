import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function Navbar() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      if (!active) return;
      setIsAuthed(!!uid);
      if (!uid) { setIsAdmin(false); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      if (!active) return;
      setIsAdmin((roles ?? []).some((r) => r.role === "admin"));
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-border bg-background/60 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-8 bg-primary rounded-lg flex items-center justify-center font-bold text-primary-foreground">
            Q
          </div>
          <span className="font-display text-2xl tracking-wider">QUIZVERSE</span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-6">
          <Link to="/join" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
            Join
          </Link>
          {isAdmin && (
            <Link to="/admin" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
              Admin
            </Link>
          )}
          {!isAuthed ? (
            <>
              <Link to="/login" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
                Login
              </Link>
              <Link to="/register" className="px-4 py-2 bg-foreground text-background text-sm font-bold rounded-full hover:bg-foreground/90 transition-all active:scale-95">
                Get Started
              </Link>
            </>
          ) : (
            <button
              onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
              className="px-4 py-2 bg-foreground/10 text-foreground text-sm font-bold rounded-full hover:bg-foreground/20 transition-all active:scale-95"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}