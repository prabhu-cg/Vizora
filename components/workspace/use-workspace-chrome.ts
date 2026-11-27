"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { matchShortcut, shouldHandle } from "@/features/editor/shortcuts";
import { usePersistentState } from "@/hooks/use-persistent-state";

interface Panels {
  left: boolean;
  right: boolean;
}
const isPanels = (v: unknown): v is Panels => typeof v === "object" && v !== null && typeof (v as Panels).left === "boolean" && typeof (v as Panels).right === "boolean";

export interface Chrome {
  leftOpen: boolean;
  rightOpen: boolean;
  /** Full-screen canvas: everything but the work is hidden. */
  focus: boolean;
  toggleLeft: () => void;
  toggleRight: () => void;
  toggleFocus: () => void;
  exitFocus: () => void;
}

/**
 * Which workspace panels are open, and whether the canvas is full screen.
 * Panel choices are remembered in this browser; full screen never is (you
 * should always arrive to a normal workspace).
 */
export function useWorkspaceChrome(): Chrome {
  const [panels, setPanels] = usePersistentState<Panels>("vizora-panels", { left: true, right: true }, isPanels);
  const [focus, setFocus] = useState(false);
  const usedBrowserFullscreen = useRef(false);

  const exitFocus = useCallback(() => {
    setFocus(false);
    if (usedBrowserFullscreen.current && document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
    usedBrowserFullscreen.current = false;
  }, []);

  const toggleFocus = useCallback(() => {
    setFocus((on) => {
      if (on) {
        if (usedBrowserFullscreen.current && document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
        usedBrowserFullscreen.current = false;
        return false;
      }
      // Also ask the browser to go full screen where it can; the layout works either way.
      void document.documentElement.requestFullscreen?.().then(() => (usedBrowserFullscreen.current = true), () => undefined);
      return true;
    });
  }, []);

  // If the person leaves browser full screen themselves (Esc), leave our mode too.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && usedBrowserFullscreen.current) {
        usedBrowserFullscreen.current = false;
        setFocus(false);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleLeft = useCallback(() => setPanels((p) => ({ ...p, left: !p.left })), [setPanels]);
  const toggleRight = useCallback(() => setPanels((p) => ({ ...p, right: !p.right })), [setPanels]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = matchShortcut(e);
      if (!action || !shouldHandle(action, e.target, document)) return;
      if (action === "toggle-left") toggleLeft();
      else if (action === "toggle-right") toggleRight();
      else if (action === "focus") toggleFocus();
      else if (action === "deselect" && focus) exitFocus(); // Escape leaves full screen (it also clears the selection elsewhere)
      else return;
      if (action !== "deselect") e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleLeft, toggleRight, toggleFocus, exitFocus, focus]);

  return useMemo(
    () => ({ leftOpen: panels.left, rightOpen: panels.right, focus, toggleLeft, toggleRight, toggleFocus, exitFocus }),
    [panels, focus, toggleLeft, toggleRight, toggleFocus, exitFocus],
  );
}
