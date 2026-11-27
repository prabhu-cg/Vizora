import type { IRLayout, IRViewport } from "@/types/visualisation";

export const DEFAULT_LAYOUT: IRLayout = {
  algorithm: "manual",
  direction: "TB",
  spacing: { x: 80, y: 80 },
};

export const DEFAULT_VIEWPORT: IRViewport = { x: 0, y: 0, zoom: 1 };
