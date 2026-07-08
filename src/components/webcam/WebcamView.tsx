import { useCallback, useRef, useState } from "react";
import Webcam from "react-webcam";
import { AnimatePresence, motion } from "framer-motion";
import { VideoOff } from "lucide-react";
import GlassPanel from "@/components/ui/GlassPanel";
import StatusIndicator from "@/components/ui/StatusIndicator";
import CameraPermissionPrompt from "@/components/webcam/CameraPermissionPrompt";
import CameraPermissionDenied from "@/components/webcam/CameraPermissionDenied";
import CameraSelectDialog from "@/components/webcam/CameraSelectDialog";
import CameraOffScreen from "@/components/webcam/CameraOffScreen";
import PoseOverlay from "@/components/pose/PoseOverlay";
import GarmentOverlay from "@/components/garment/GarmentOverlay";
import { usePoseLandmarker } from "@/hooks/usePoseLandmarker";
import { useVideoDevices } from "@/hooks/useVideoDevices";
import type { GarmentDefinition } from "@/types/garment";
import { cn } from "@/utils/cn";

type CameraState =
  | "idle"
  | "requesting-access"
  | "selecting-device"
  | "starting"
  | "granted"
  | "off"
  | "denied";

interface WebcamViewProps {
  /** Garment currently selected in the garment rail, or null for none. */
  garment?: GarmentDefinition | null;
}

/**
 * The try-on preview stage.
 *
 * Lifecycle:
 *   idle → requesting-access   (unlock permission + real device labels)
 *        → selecting-device    (premium picker — built-in, USB, or phone
 *                                cameras exposed via tools like Microsoft
 *                                Phone Link)
 *        → starting             (mounting react-webcam with the chosen
 *                                deviceId)
 *        → granted               (mirrored live feed + status badge)
 *        → off                   (deliberately stopped — "Camera Off"
 *                                  button; resumes straight into "starting"
 *                                  with the same device, no re-prompt)
 *   or → denied at any permission failure, with a retry path back to
 *        requesting-access.
 *
 * The chosen camera is remembered (via useVideoDevices) — if it's still
 * present next time, access is requested straight into "starting" instead
 * of showing the picker again. "Change camera" reopens the picker;
 * "Camera Off" stops the feed without forgetting the device or permission.
 *
 * Pose detection (usePoseLandmarker) is owned here rather than inside
 * PoseOverlay, because GarmentOverlay needs the same detected landmarks
 * and video dimensions — sharing one detection loop between both overlays
 * instead of running MediaPipe twice.
 */
export default function WebcamView({ garment = null }: WebcamViewProps) {
  const [state, setState] = useState<CameraState>("idle");
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const { devices, selectedDeviceId, selectDevice, refresh } = useVideoDevices();

  // react-webcam's ref behavior differs by version: some forward the ref
  // straight to the underlying <video> element, others give the component
  // instance (which exposes the real element via `.video`). This callback
  // ref handles both shapes so pose detection always gets a real
  // HTMLVideoElement, never the wrong object.
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const setVideoRef = useCallback((instance: Webcam | null) => {
    if (!instance) {
      videoRef.current = null;
      return;
    }
    const maybeVideo = (instance as unknown as { video?: HTMLVideoElement | null })
      .video;
    videoRef.current = maybeVideo ?? (instance as unknown as HTMLVideoElement);
  }, []);
  const poseCanvasRef = useRef<HTMLCanvasElement>(null);
  const garmentCanvasRef = useRef<HTMLCanvasElement>(null);

  const { aiStatus, fps, landmarksRef, dimensions } = usePoseLandmarker({
    videoRef,
    canvasRef: poseCanvasRef,
    enabled: state === "granted",
  });

  const requestAccess = useCallback(async () => {
    setState("requesting-access");
    try {
      // A short-lived stream is enough to unlock permission and device
      // labels — it's stopped immediately; react-webcam opens the real one
      // once a device is chosen.
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());

      const list = await refresh();

      if (selectedDeviceId && list.some((d) => d.deviceId === selectedDeviceId)) {
        setActiveDeviceId(selectedDeviceId);
        setState("starting");
      } else {
        setState("selecting-device");
      }
    } catch {
      setState("denied");
    }
  }, [refresh, selectedDeviceId]);

  const handleConfirmDevice = useCallback(
    (deviceId: string) => {
      selectDevice(deviceId);
      setActiveDeviceId(deviceId);
      setState("starting");
    },
    [selectDevice]
  );

  const handleUserMedia = useCallback(() => setState("granted"), []);
  const handleUserMediaError = useCallback(() => setState("denied"), []);
  const handleChangeCamera = useCallback(() => setState("selecting-device"), []);
  const handleTurnOff = useCallback(() => setState("off"), []);

  // Resuming from "off" should never re-show the permission prompt or the
  // device picker — permission and device choice are still valid, only the
  // stream itself was stopped.
  const handleTurnOn = useCallback(() => {
    if (activeDeviceId) {
      setState("starting");
    } else {
      requestAccess();
    }
  }, [activeDeviceId, requestAccess]);

  const isStreaming = state === "starting" || state === "granted";

  return (
    <GlassPanel
      elevated
      className={cn(
        "relative aspect-[4/5] overflow-hidden sm:aspect-[16/10]",
        !isStreaming && "border-dashed"
      )}
    >
      <AnimatePresence mode="wait">
        {state === "idle" && <CameraPermissionPrompt onRequest={requestAccess} />}

        {state === "requesting-access" && (
          <motion.div
            key="requesting-access"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="flex h-full flex-col items-center justify-center gap-3"
          >
            <span className="h-8 w-8 animate-spin rounded-full border border-white/[0.15] border-t-white/70" />
            <p className="font-mono text-[11px] uppercase tracking-widest2 text-muted">
              Waiting for permission
            </p>
          </motion.div>
        )}

        {state === "selecting-device" && (
          <CameraSelectDialog
            devices={devices}
            initialDeviceId={selectedDeviceId}
            onConfirm={handleConfirmDevice}
            onRefresh={refresh}
          />
        )}

        {state === "off" && <CameraOffScreen onTurnOn={handleTurnOn} />}

        {state === "denied" && <CameraPermissionDenied onRetry={requestAccess} />}
      </AnimatePresence>

      {isStreaming && activeDeviceId && (
        <div className="absolute inset-0">
          <Webcam
            ref={setVideoRef}
            audio={false}
            mirrored
            videoConstraints={{ deviceId: { exact: activeDeviceId } }}
            onUserMedia={handleUserMedia}
            onUserMediaError={handleUserMediaError}
            className={cn(
              "h-full w-full object-cover transition-opacity duration-700 ease-out",
              state === "granted" ? "opacity-100" : "opacity-0"
            )}
          />

          {/* Garment canvas — sits above the video, below the skeleton,
              so the pose skeleton (used for QA/debugging) stays fully
              visible exactly as before. */}
          <GarmentOverlay
            canvasRef={garmentCanvasRef}
            landmarksRef={landmarksRef}
            garment={garment}
            videoDimensions={dimensions}
            enabled={state === "granted"}
          />

          {/* Pose skeleton canvas + AI status + FPS — enabled once the
              feed is live; cleans up automatically when unmounted.       */}
          <PoseOverlay
            canvasRef={poseCanvasRef}
            aiStatus={aiStatus}
            fps={fps}
          />

          <AnimatePresence>
            {state === "starting" && (
              <motion.div
                key="starting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-void"
              >
                <span className="h-8 w-8 animate-spin rounded-full border border-white/[0.15] border-t-white/70" />
                <p className="font-mono text-[11px] uppercase tracking-widest2 text-muted">
                  Starting camera
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {state === "granted" && (
              <motion.div
                key="ready-row"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-x-4 top-4 flex items-center justify-between gap-3"
              >
                <StatusIndicator label="Camera Ready" tone="ready" />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleChangeCamera}
                    className="rounded-full border border-white/[0.10] bg-black/40 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-wide2 text-fog backdrop-blur-md transition-colors duration-300 hover:border-white/25 hover:text-white"
                  >
                    Change camera
                  </button>

                  <button
                    type="button"
                    onClick={handleTurnOff}
                    aria-label="Turn camera off"
                    className="flex items-center gap-1.5 rounded-full border border-white/[0.10] bg-black/40 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-wide2 text-fog backdrop-blur-md transition-colors duration-300 hover:border-white/25 hover:text-white"
                  >
                    <VideoOff size={12} strokeWidth={1.8} />
                    Camera Off
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </GlassPanel>
  );
}
