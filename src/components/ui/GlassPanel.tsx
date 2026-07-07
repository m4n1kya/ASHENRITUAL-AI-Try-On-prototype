import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/utils/cn";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Slightly brighter border + soft shadow, for the primary hero panel. */
  elevated?: boolean;
}

/**
 * Shared frosted-glass surface used for cards, the try-on stage, and the
 * about page. Very subtle blur, thin white border, soft shadow — kept
 * consistent so no two panels in the app drift out of sync.
 */
export default function GlassPanel({
  children,
  elevated = false,
  className,
  ...rest
}: GlassPanelProps) {
  return (
    <div
      className={cn(
        "rounded-card border backdrop-blur-md",
        elevated
          ? "border-white/[0.14] bg-white/[0.045] shadow-glow-sm"
          : "border-white/[0.08] bg-white/[0.04] shadow-panel",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
