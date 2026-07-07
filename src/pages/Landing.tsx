import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ScanFace, Video, Sparkles } from "lucide-react";
import Button from "@/components/ui/Button";
import GlassPanel from "@/components/ui/GlassPanel";
import GradientBackground from "@/components/ui/GradientBackground";

const FEATURES = [
  {
    icon: ScanFace,
    title: "Real-Time AI",
    copy: "Garments are fitted to you the instant you step in front of the camera — no waiting on a render queue.",
  },
  {
    icon: Video,
    title: "Video Try-On Camera Tracking",
    copy: "Continuous tracking follows posture and movement, so the fit holds as you turn, not just when you stand still.",
  },
  {
    icon: Sparkles,
    title: "Future Commerce",
    copy: "A fitting room that lives before checkout — try, decide, and buy with certainty instead of a return label.",
  },
];

const heroFade = {
  hidden: { opacity: 0, y: 22 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, delay: 0.15 * i, ease: [0.16, 1, 0.3, 1] },
  }),
};

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="relative">
      {/* ===== Hero ===== */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
        <GradientBackground withParticles />

        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">
          <motion.span
            variants={heroFade}
            initial="hidden"
            animate="show"
            custom={0}
            className="mb-8 inline-flex items-center rounded-full border border-white/[0.12] bg-white/[0.03] px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest2 text-muted"
          >
            AI Virtual Try-On — Prototype
          </motion.span>

          <motion.h1
            variants={heroFade}
            initial="hidden"
            animate="show"
            custom={1}
            className="text-balance font-display text-6xl font-medium leading-[1.05] tracking-wide2 text-white sm:text-7xl lg:text-8xl"
          >
            Wear Tomorrow.
            <br />
            <span className="text-fog">Today.</span>
          </motion.h1>

          <motion.p
            variants={heroFade}
            initial="hidden"
            animate="show"
            custom={2}
            className="mt-8 max-w-xl font-body text-base leading-relaxed text-muted sm:text-lg"
          >
            Experience AI-powered luxury fashion before you buy.
          </motion.p>

          <motion.div
            variants={heroFade}
            initial="hidden"
            animate="show"
            custom={3}
            className="mt-12 flex flex-col items-center gap-4 sm:flex-row"
          >
            <Button
              variant="primary"
              icon={<ArrowRight size={16} strokeWidth={2} />}
              onClick={() => navigate("/try-on")}
            >
              Launch Try-On
            </Button>
            <Button variant="secondary" onClick={() => navigate("/about")}>
              Explore Technology
            </Button>
          </motion.div>
        </div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-widest2 text-white/20"
        >
          Scroll
        </motion.div>
      </section>

      {/* ===== Feature cards ===== */}
      <section className="relative border-t border-white/[0.06] bg-void px-6 py-32">
        <div className="mx-auto max-w-6xl">
          <div className="mb-20 max-w-lg">
            <h2 className="font-display text-4xl font-medium tracking-wide2 text-white sm:text-5xl">
              Built for what's next
            </h2>
            <p className="mt-5 font-body text-sm leading-relaxed text-muted">
              Three capabilities define the fitting room of the future — quiet
              engineering, held to a very high bar.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.7, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              >
                <GlassPanel className="h-full p-8">
                  <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.03]">
                    <feature.icon size={18} strokeWidth={1.4} className="text-white" />
                  </div>
                  <h3 className="font-display text-xl font-medium tracking-wide2 text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-3 font-body text-sm leading-relaxed text-muted">
                    {feature.copy}
                  </p>
                </GlassPanel>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
