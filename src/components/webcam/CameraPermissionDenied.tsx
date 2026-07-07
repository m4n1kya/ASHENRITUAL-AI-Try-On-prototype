import { motion } from "framer-motion";
import { CameraOff } from "lucide-react";
import Button from "@/components/ui/Button";

interface CameraPermissionDeniedProps {
  onRetry: () => void;
}

/**
 * Premium error state for a denied/blocked camera permission. Explains the
 * likely cause in plain terms and offers a single clear way forward.
 */
export default function CameraPermissionDenied({
  onRetry,
}: CameraPermissionDeniedProps) {
  return (
    <motion.div
      key="permission-denied"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex h-full flex-col items-center justify-center gap-6 p-10 text-center"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="flex h-16 w-16 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04]"
      >
        <CameraOff size={26} strokeWidth={1.4} className="text-muted" />
      </motion.div>

      <div className="max-w-sm">
        <p className="font-display text-xl font-medium tracking-wide2 text-white">
          Camera access denied
        </p>
        <p className="mt-2 font-body text-sm leading-relaxed text-muted">
          Check your browser's site settings to allow camera access for this
          page, then try again.
        </p>
      </div>

      <Button variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    </motion.div>
  );
}
