import { motion } from "framer-motion";
import GlassPanel from "@/components/ui/GlassPanel";

const STACK = [
  "React",
  "TypeScript",
  "Vite",
  "Tailwind CSS",
  "React Router",
  "Framer Motion",
  "Lucide React",
];

export default function About() {
  return (
    <div className="relative min-h-screen bg-void px-6 pb-24 pt-32">
      <div className="mx-auto max-w-3xl">
        <span className="font-mono text-[11px] uppercase tracking-widest2 text-muted">
          About the Prototype
        </span>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-3 font-display text-4xl text-white sm:text-5xl"
        >
          A foundation, not a finished garment
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-6 font-body text-base leading-relaxed text-fog"
        >
          ASHENRITUAL AI is a standalone frontend prototype for a real-time virtual
          try-on experience, built ahead of its eventual integration into a larger
          luxury fashion platform. This build establishes the structure, routing,
          and visual language the feature will live in — the capture pipeline and
          AI rendering are deliberately out of scope here.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-12"
        >
          <GlassPanel className="p-8">
            <h2 className="font-display text-xl text-white">Scope of this build</h2>
            <ul className="mt-4 space-y-3 font-body text-sm text-fog">
              <li>
                <span className="text-white">Included —</span> routing, layout,
                design system, and the Try-On UI shell.
              </li>
              <li>
                <span className="text-muted">Not included —</span> camera access,
                pose estimation, garment rendering, or any backend service.
              </li>
            </ul>
          </GlassPanel>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8"
        >
          <h2 className="font-display text-xl text-white">Built with</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {STACK.map((tech) => (
              <span
                key={tech}
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 font-mono text-xs text-fog"
              >
                {tech}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
