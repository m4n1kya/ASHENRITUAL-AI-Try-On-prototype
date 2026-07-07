import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Check, RefreshCw, Smartphone } from "lucide-react";
import Button from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import type { VideoDevice } from "@/hooks/useVideoDevices";

interface CameraSelectDialogProps {
  devices: VideoDevice[];
  initialDeviceId?: string | null;
  onConfirm: (deviceId: string) => void;
  onRefresh: () => void;
}

function isPhoneDevice(label: string) {
  const lower = label.toLowerCase();
  return (
    lower.includes("phone") ||
    lower.includes("iphone") ||
    lower.includes("android") ||
    lower.includes("link to windows")
  );
}

/**
 * Premium camera picker shown once permission has been granted and device
 * labels are available. Lists every video input — built-in webcams,
 * external USB cameras, and phone cameras exposed through tools like
 * Microsoft Phone Link — so the person can choose exactly which one feeds
 * the try-on stage before it starts.
 */
export default function CameraSelectDialog({
  devices,
  initialDeviceId,
  onConfirm,
  onRefresh,
}: CameraSelectDialogProps) {
  const [selected, setSelected] = useState<string | null>(
    initialDeviceId && devices.some((d) => d.deviceId === initialDeviceId)
      ? initialDeviceId
      : devices[0]?.deviceId ?? null
  );

  // If the list arrives (or changes) after mount, make sure something
  // sensible stays selected instead of leaving the picker empty.
  useEffect(() => {
    if (selected && devices.some((d) => d.deviceId === selected)) return;
    setSelected(devices[0]?.deviceId ?? null);
  }, [devices, selected]);

  return (
    <motion.div
      key="camera-select"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex h-full flex-col p-8"
    >
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="font-display text-lg font-medium tracking-wide2 text-white">
            Choose a camera
          </p>
          <p className="mt-1 font-body text-xs text-muted">
            {devices.length} {devices.length === 1 ? "device" : "devices"} found
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh camera list"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.10] text-muted transition-colors duration-300 hover:border-white/25 hover:text-white"
        >
          <RefreshCw size={14} strokeWidth={1.6} />
        </button>
      </div>

      {devices.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="max-w-xs text-center font-body text-sm text-muted">
            No cameras were found. Connect a webcam or a phone camera, then
            refresh.
          </p>
        </div>
      ) : (
        <ul className="flex-1 space-y-2 overflow-y-auto">
          {devices.map((device) => {
            const Icon = isPhoneDevice(device.label) ? Smartphone : Camera;
            const isActive = device.deviceId === selected;
            return (
              <li key={device.deviceId}>
                <button
                  type="button"
                  onClick={() => setSelected(device.deviceId)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-300",
                    isActive
                      ? "border-white/[0.22] bg-white/[0.06]"
                      : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16] hover:bg-white/[0.04]"
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.10] bg-black/30">
                    <Icon size={16} strokeWidth={1.5} className="text-white" />
                  </span>
                  <span className="flex-1 truncate font-body text-sm text-white">
                    {device.label}
                  </span>
                  {isActive && (
                    <Check size={16} strokeWidth={2} className="shrink-0 text-white" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Button
        variant="primary"
        disabled={!selected}
        onClick={() => selected && onConfirm(selected)}
        className="mt-6 w-full"
      >
        Use this camera
      </Button>
    </motion.div>
  );
}
