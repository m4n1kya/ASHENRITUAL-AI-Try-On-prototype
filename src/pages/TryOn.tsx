import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ShirtIcon, Sliders } from "lucide-react";
import GlassPanel from "@/components/ui/GlassPanel";
import Button from "@/components/ui/Button";
import WebcamView from "@/components/webcam/WebcamView";
import { PLACEHOLDER_GARMENTS } from "@/data/garments";
import { cn } from "@/utils/cn";

/**
 * UI shell for the try-on experience.
 *
 * The preview stage hosts a live, mirrored webcam feed via WebcamView
 * (permission prompt → requesting → live feed / denied), with pose
 * tracking and the garment overlay layered above it.
 *
 * All four garment rail items are now wired to the rendering pipeline —
 * clicking one selects it (clicking the active one deselects), and
 * WebcamView receives exactly one GarmentDefinition or null. The
 * GarmentOverlay / useGarmentRenderer / garmentMath pipeline underneath
 * is unchanged from Phase 2 — it was built garment-agnostic from the
 * start, so wiring in three more garments required no changes there,
 * only more entries in the data catalog.
 */
export default function TryOn() {
  const [selectedGarmentId, setSelectedGarmentId] = useState<string | null>(null);

  const selectedGarment =
    PLACEHOLDER_GARMENTS.find((g) => g.id === selectedGarmentId) ?? null;

  const handleSelect = (garmentId: string) => {
    setSelectedGarmentId((current) => (current === garmentId ? null : garmentId));
  };

  return (
    <div className="relative min-h-screen bg-void px-6 pb-24 pt-32">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10">
          <span className="font-mono text-[11px] uppercase tracking-widest2 text-muted">
            Prototype Stage
          </span>
          <h1 className="mt-3 font-display text-4xl text-white sm:text-5xl">
            Try-On Studio
          </h1>
          <p className="mt-3 max-w-xl font-body text-sm text-fog">
            Enable your camera, then select a garment to preview the live
            shoulder-anchored overlay. These are placeholder silhouettes —
            real garment capture will replace them.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Preview stage */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <WebcamView garment={selectedGarment} />
          </motion.div>

          {/* Garment rail + controls */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col gap-6"
          >
            <GlassPanel className="p-6">
              <div className="mb-4 flex items-center gap-2 text-fog">
                <ShirtIcon size={16} strokeWidth={1.5} />
                <span className="font-mono text-xs uppercase tracking-widest2">
                  Garment Rail
                </span>
              </div>

              <ul className="flex flex-col divide-y divide-white/5">
                {PLACEHOLDER_GARMENTS.map((garment) => {
                  const isActive = garment.id === selectedGarmentId;
                  return (
                    <li key={garment.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(garment.id)}
                        aria-pressed={isActive}
                        className={cn(
                          "flex w-full items-center justify-between py-3 text-left transition-opacity duration-300",
                          !isActive && "opacity-80 hover:opacity-100"
                        )}
                      >
                        <div>
                          <p className="font-body text-sm text-white">
                            {garment.name}
                          </p>
                          <p className="font-mono text-[11px] capitalize text-muted">
                            {garment.category}
                          </p>
                        </div>

                        {isActive ? (
                          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide2 text-white">
                            <Check size={12} strokeWidth={2.5} />
                            active
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] uppercase tracking-wide2 text-muted">
                            select
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </GlassPanel>

            <GlassPanel className="p-6">
              <div className="mb-4 flex items-center gap-2 text-fog">
                <Sliders size={16} strokeWidth={1.5} />
                <span className="font-mono text-xs uppercase tracking-widest2">
                  Fit Controls
                </span>
              </div>
              <p className="mb-5 font-body text-xs text-muted">
                Placeholder controls — will drive live drape adjustments once
                garment physics is connected.
              </p>
              <Button variant="secondary" disabled className="w-full">
                Adjust Fit
              </Button>
            </GlassPanel>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
