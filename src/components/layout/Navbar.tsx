import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { Github } from "lucide-react";
import { useScrollPosition } from "@/hooks/useScrollPosition";
import { cn } from "@/utils/cn";

const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "Try-On", to: "/try-on" },
  { label: "About", to: "/about" },
];

export default function Navbar() {
  const scrolled = useScrollPosition(24);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-6 pt-5"
    >
      <nav
        className={cn(
          "flex w-full max-w-5xl items-center justify-between rounded-3xl border px-6 py-3.5 backdrop-blur-xl transition-all duration-500",
          scrolled
            ? "border-white/[0.10] bg-white/[0.05] shadow-panel"
            : "border-white/[0.06] bg-white/[0.02]"
        )}
      >
        <NavLink to="/" className="flex items-center">
          <span className="font-display text-lg tracking-wide2 text-white">
            ASHENRITUAL
          </span>
        </NavLink>

        <div className="flex items-center gap-1 rounded-full border border-white/[0.06] bg-black/20 p-1">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  "rounded-full px-4 py-2 font-body text-sm transition-colors duration-300",
                  isActive
                    ? "bg-white/[0.09] text-white"
                    : "text-muted hover:text-white"
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <a
          href="https://github.com/"
          target="_blank"
          rel="noreferrer"
          aria-label="View source on GitHub"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] text-muted transition-colors duration-300 hover:border-white/20 hover:text-white"
        >
          <Github size={16} strokeWidth={1.5} />
        </a>
      </nav>
    </motion.header>
  );
}
