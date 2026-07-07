import { Github } from "lucide-react";

export default function Footer() {
  return (
    <footer className="relative border-t border-white/[0.08] bg-void">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted sm:flex-row lg:px-10">
        <p className="font-body tracking-wide2">
          <span className="text-white">ASHENRITUAL</span>
          <span className="mx-2 text-white/10">/</span>
          Prototype build
        </p>

        <a
          href="https://github.com/"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-muted transition-colors duration-300 hover:text-white"
        >
          <Github size={16} strokeWidth={1.5} />
          <span>GitHub</span>
        </a>

        <p className="font-mono text-xs tracking-wide text-white/20">
          Made with React + TypeScript
        </p>
      </div>
    </footer>
  );
}
