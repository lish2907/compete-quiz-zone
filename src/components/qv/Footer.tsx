export function Footer() {
  return (
    <footer className="border-t border-border py-12 px-6 mt-12">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <span className="font-display text-xl tracking-wider text-muted-foreground">
          QUIZVERSE © 2026
        </span>
        <div className="flex gap-6 text-xs font-mono text-muted-foreground">
          <a className="hover:text-primary transition-colors" href="#">SYSTEM_STATUS: NOMINAL</a>
          <a className="hover:text-primary transition-colors" href="#">API_DOCS</a>
          <a className="hover:text-primary transition-colors" href="#">PRIVACY</a>
        </div>
      </div>
    </footer>
  );
}