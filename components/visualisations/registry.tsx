"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import type { VisualisationIR, VisualisationType } from "@/types/visualisation";

/** Contract every renderer implements. Renderers read the IR and report edits as pure updates. */
export interface RendererProps {
  document: VisualisationIR;
  onChange: (updater: (doc: VisualisationIR) => VisualisationIR) => void;
}

const loading = () => <LoadingState label="Loading renderer" rows={1} className="p-6" />;

/**
 * Renderer registry: the only place that knows which renderer draws which IR
 * type. Libraries are loaded lazily so they never weigh on the dashboard.
 * Types without an entry are not offered for creation yet.
 */
const RENDERERS: Partial<Record<VisualisationType, ComponentType<RendererProps>>> = {
  diagram: dynamic(() => import("@/features/diagrams/diagram-renderer"), { ssr: false, loading }),
  chart: dynamic(() => import("@/features/charts/chart-renderer"), { ssr: false, loading }),
};

export function hasRenderer(type: VisualisationType): boolean {
  return type in RENDERERS;
}

/** Renders the registered renderer for the document's type, or nothing if there is none. */
export function VisualisationRenderer({ type, ...props }: RendererProps & { type: VisualisationType }) {
  const Renderer = RENDERERS[type];
  return Renderer ? <Renderer {...props} /> : null;
}

export function creatableTypes(): VisualisationType[] {
  return Object.keys(RENDERERS) as VisualisationType[];
}
