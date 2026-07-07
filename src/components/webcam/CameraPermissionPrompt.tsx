import { motion } from "framer-motion";
import { Camera } from "lucide-react";
import Button from "@/components/ui/Button";

interface CameraPermissionPromptProps {
  onRequest: () => void;
}

/**
 * Shown before any camera access is requested. Sets expectations — why the
 * camera is needed and that nothing is recorded — before the browser's
 * native permission dialog appears.
 */
export default function CameraPermissionPrompt({
  onRequest,
}: CameraPermissionPromptProps) {
  return (
    <motion.div
      key="permission-prompt"
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
        <Camera size={26} strokeWidth={1.4} className="text-white" />
      </motion.div>

      <div className="max-w-sm">
        <p className="font-display text-xl font-medium tracking-wide2 text-white">
          Enable your camera
        </p>
        <p className="mt-2 font-body text-sm leading-relaxed text-muted">
          Your camera powers the live fitting preview. Nothing is recorded or
          stored — the feed stays on this device.
        </p>
      </div>

      <Button variant="primary" onClick={onRequest}>
        Enable Camera
      </Button>
    </motion.div>
  );
}
