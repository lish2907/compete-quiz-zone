import { Link } from "@tanstack/react-router";

export function Navbar() {
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
          <Link
            to="/login"
            className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors"
          >
            Login
          </Link>
          <Link
            to="/register"
            className="px-4 py-2 bg-foreground text-background text-sm font-bold rounded-full hover:bg-foreground/90 transition-all active:scale-95"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}