import { motion } from "framer-motion";
import { VideoOff } from "lucide-react";
import Button from "@/components/ui/Button";

interface CameraOffScreenProps {
  onTurnOn: () => void;
}

/**
 * Shown after the person explicitly turns the camera off (as opposed to
 * "denied", which means the browser refused access). The distinction
 * matters: turning back on here should not re-trigger the permission
 * flow or the device picker — it's a direct resume.
 */
export default function CameraOffScreen({ onTurnOn }: CameraOffScreenProps) {
  return (
    <motion.div
      key="camera-off"
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
        <VideoOff size={26} strokeWidth={1.4} className="text-muted" />
      </motion.div>

      <div className="max-w-sm">
        <p className="font-display text-xl font-medium tracking-wide2 text-white">
          Camera turned off
        </p>
        <p className="mt-2 font-body text-sm leading-relaxed text-muted">
          Your feed has stopped and the camera light is off. Turn it back on
          whenever you're ready to continue.
        </p>
      </div>

      <Button variant="primary" onClick={onTurnOn}>
        Turn Camera On
      </Button>
    </motion.div>
  );
}
