"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { isEngineType } from "@/lib/engine/semantics";
import type { VisualisationIR, VisualisationType } from "@/types/visualisation";

/** Contract for renderers that draw a whole document themselves (charts). */
export interface RendererProps {
  document: VisualisationIR;
  onChange: (updater: (doc: VisualisationIR) => VisualisationIR) => void;
}

const loading = () => <LoadingState label="Loading chart" rows={1} className="p-6" />;

/** Flowcharts, mind maps, concept maps and timelines share the editor canvas; charts have their own renderer, loaded on demand. */
const CHART = dynamic(() => import("@/features/charts/chart-renderer"), { ssr: false, loading }) as ComponentType<RendererProps>;

export function hasRenderer(type: VisualisationType): boolean {
  return isEngineType(type) || type === "chart";
}

export function VisualisationRenderer({ type, ...props }: RendererProps & { type: VisualisationType }) {
  return type === "chart" ? <CHART {...props} /> : null;
}

/** Types a person can create today, in the order they are offered. */
export function creatableTypes(): VisualisationType[] {
  return ["flowchart", "mindmap", "conceptmap", "timeline", "chart"];
}
