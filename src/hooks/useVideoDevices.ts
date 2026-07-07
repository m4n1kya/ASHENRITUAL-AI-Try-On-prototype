import { useCallback, useEffect, useState } from "react";

export interface VideoDevice {
  deviceId: string;
  label: string;
}

const STORAGE_KEY = "ashenritual:selected-camera";

function readStoredDeviceId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage disabled (private mode, locked-down browser policy, etc).
    // Selection still works for the current session — it just won't persist.
    return null;
  }
}

/**
 * Enumerates available video input devices — built-in webcams, external
 * USB cameras, and phone cameras exposed through tools like Microsoft
 * Phone Link — and tracks/persists which one is selected.
 *
 * Device *labels* are only populated by the browser once camera permission
 * has been granted at least once for this origin, so callers should request
 * access before relying on `refresh()` to return human-readable names.
 *
 * Also listens for the `devicechange` event so a camera plugged in (or a
 * phone connected) after the picker is already open still shows up.
 */
export function useVideoDevices() {
  const [devices, setDevices] = useState<VideoDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceIdState] = useState<string | null>(
    readStoredDeviceId
  );

  const refresh = useCallback(async (): Promise<VideoDevice[]> => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = all
        .filter((d) => d.kind === "videoinput")
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${i + 1}`,
        }));
      setDevices(videoInputs);
      return videoInputs;
    } catch {
      setDevices([]);
      return [];
    }
  }, []);

  useEffect(() => {
    refresh();
    const handleChange = () => refresh();
    navigator.mediaDevices.addEventListener("devicechange", handleChange);
    return () =>
      navigator.mediaDevices.removeEventListener("devicechange", handleChange);
  }, [refresh]);

  const selectDevice = useCallback((deviceId: string) => {
    setSelectedDeviceIdState(deviceId);
    try {
      localStorage.setItem(STORAGE_KEY, deviceId);
    } catch {
      /* selection still applies for this session even if it can't persist */
    }
  }, []);

  return { devices, selectedDeviceId, selectDevice, refresh };
}
