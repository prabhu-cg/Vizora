import type { SVGProps } from "react";
import type { VisualKind } from "@/lib/marketing/content";
import { cn } from "@/lib/utils/cn";

/**
 * Hand-built illustrations of each visualisation type, drawn with design
 * tokens so they follow the light/dark theme. They are illustrations, not
 * screenshots, and every use is captioned or labelled as such.
 */
type P = Omit<SVGProps<SVGSVGElement>, "viewBox"> & { title?: string };

const BOX = "fill-card stroke-border-strong";
const ACCENT = "fill-primary stroke-primary-hover";
const LINE = "stroke-muted-foreground";
const TXT = "fill-foreground text-[9px]";

function Arrow({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const s = 5;
  const p = (da: number) => `${x2 - s * Math.cos(a + da)},${y2 - s * Math.sin(a + da)}`;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2 - 3 * Math.cos(a)} y2={y2 - 3 * Math.sin(a)} className={LINE} strokeWidth={1.4} />
      <polygon points={`${x2},${y2} ${p(0.45)} ${p(-0.45)}`} className="fill-muted-foreground" />
    </g>
  );
}

function Svg({ title, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 240 150" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} {...rest}>
      {children}
    </svg>
  );
}

export function FlowchartVisual(props: P) {
  return (
    <Svg {...props}>
      <rect x="20" y="10" width="80" height="26" rx="13" className={BOX} />
      <text x="60" y="27" textAnchor="middle" className={TXT}>Start</text>
      <Arrow x1={60} y1={36} x2={60} y2={58} />
      <rect x="20" y="58" width="80" height="26" rx="6" className={BOX} />
      <text x="60" y="75" textAnchor="middle" className={TXT}>Review</text>
      <Arrow x1={60} y1={84} x2={60} y2={103} />
      <polygon points="60,103 88,120 60,137 32,120" className={BOX} />
      <text x="60" y="123" textAnchor="middle" className={TXT}>OK?</text>
      <Arrow x1={88} y1={120} x2={140} y2={120} />
      <rect x="140" y="107" width="82" height="26" rx="6" className={ACCENT} />
      <text x="181" y="124" textAnchor="middle" className="fill-primary-foreground text-[9px]">Publish</text>
      <path d="M32 120 H12 V71 H20" fill="none" className={LINE} strokeWidth={1.4} strokeDasharray="3 3" />
      <text x="114" y="114" textAnchor="middle" className="fill-muted-foreground text-[8px]">yes</text>
    </Svg>
  );
}

export function MindmapVisual(props: P) {
  const branches: [number, number, string][] = [
    [36, 28, "Goals"],
    [36, 106, "Risks"],
    [204, 28, "People"],
    [204, 106, "Ideas"],
    [120, 138, "Next"],
  ];
  return (
    <Svg {...props}>
      {branches.map(([x, y, label]) => (
        <g key={label}>
          <path d={`M120 70 Q${(120 + x) / 2} ${70} ${x} ${y}`} fill="none" className="stroke-border-strong" strokeWidth={1.6} />
          <rect x={x - 26} y={y - 11} width="52" height="22" rx="11" className={BOX} />
          <text x={x} y={y + 3} textAnchor="middle" className={TXT}>{label}</text>
        </g>
      ))}
      <circle cx="120" cy="70" r="24" className={ACCENT} />
      <text x="120" y="73" textAnchor="middle" className="fill-primary-foreground text-[10px]">Topic</text>
    </Svg>
  );
}

export function ConceptmapVisual(props: P) {
  return (
    <Svg {...props}>
      <Arrow x1={78} y1={40} x2={158} y2={40} />
      <text x="118" y="34" textAnchor="middle" className="fill-muted-foreground text-[8px]">feeds</text>
      <Arrow x1={190} y1={52} x2={190} y2={100} />
      <text x="196" y="80" className="fill-muted-foreground text-[8px]">explains</text>
      <Arrow x1={50} y1={52} x2={50} y2={100} />
      <text x="56" y="80" className="fill-muted-foreground text-[8px]">raises</text>
      <Arrow x1={78} y1={112} x2={160} y2={112} />
      <text x="118" y="106" textAnchor="middle" className="fill-muted-foreground text-[8px]">answers</text>
      <rect x="20" y="28" width="58" height="24" rx="12" className={BOX} />
      <text x="49" y="43" textAnchor="middle" className={TXT}>Data</text>
      <rect x="158" y="28" width="64" height="24" rx="12" className={BOX} />
      <text x="190" y="43" textAnchor="middle" className={TXT}>Chart</text>
      <rect x="160" y="100" width="62" height="24" rx="12" className={ACCENT} />
      <text x="191" y="115" textAnchor="middle" className="fill-primary-foreground text-[9px]">Insight</text>
      <rect x="14" y="100" width="70" height="24" rx="12" className={BOX} />
      <text x="49" y="115" textAnchor="middle" className={TXT}>Question</text>
    </Svg>
  );
}

export function TimelineVisual(props: P) {
  const marks: [number, string, boolean][] = [
    [30, "Plan", false],
    [78, "Build", false],
    [126, "Test", true],
    [174, "Launch", false],
    [216, "Review", false],
  ];
  return (
    <Svg {...props}>
      <line x1="12" y1="75" x2="228" y2="75" className="stroke-border-strong" strokeWidth={3} strokeLinecap="round" />
      {marks.map(([x, label, hot], i) => {
        const up = i % 2 === 0;
        return (
          <g key={label}>
            <line x1={x} y1={75} x2={x} y2={up ? 52 : 98} className="stroke-border-strong" strokeWidth={1.4} />
            <rect x={x - 22} y={up ? 30 : 98} width="44" height="22" rx="6" className={hot ? ACCENT : BOX} />
            <text x={x} y={up ? 44 : 112} textAnchor="middle" className={hot ? "fill-primary-foreground text-[9px]" : TXT}>{label}</text>
            <circle cx={x} cy={75} r="5" className={hot ? ACCENT : "fill-background stroke-muted-foreground"} strokeWidth={1.6} />
          </g>
        );
      })}
    </Svg>
  );
}

export function ChartVisual(props: P) {
  const bars = [38, 56, 44, 72, 90];
  const pts = bars.map((h, i) => `${52 + i * 34},${118 - h * 0.95}`).join(" ");
  return (
    <Svg {...props}>
      <line x1="30" y1="120" x2="228" y2="120" className="stroke-border-strong" />
      <line x1="30" y1="20" x2="30" y2="120" className="stroke-border-strong" />
      {[40, 70, 100].map((y) => (
        <line key={y} x1="30" y1={y} x2="228" y2={y} className="stroke-border" strokeDasharray="2 4" />
      ))}
      {bars.map((h, i) => (
        <rect key={i} x={40 + i * 34} y={120 - h} width="24" height={h} rx="3" className={i === 4 ? ACCENT : "fill-muted-foreground/70"} />
      ))}
      <polyline points={pts} fill="none" className="stroke-info" strokeWidth={2} strokeLinejoin="round" />
      {bars.map((h, i) => (
        <circle key={i} cx={52 + i * 34} cy={118 - h * 0.95} r="3" className="fill-info" />
      ))}
    </Svg>
  );
}

export function DashboardVisual(props: P) {
  return (
    <Svg {...props}>
      <rect x="10" y="10" width="68" height="40" rx="8" className={BOX} />
      <text x="20" y="26" className="fill-muted-foreground text-[8px]">Total</text>
      <text x="20" y="44" className="fill-foreground text-[16px]">1,284</text>
      <rect x="86" y="10" width="68" height="40" rx="8" className={BOX} />
      <text x="96" y="26" className="fill-muted-foreground text-[8px]">Growth</text>
      <text x="96" y="44" className="fill-primary-text text-[16px]">+12%</text>
      <rect x="162" y="10" width="68" height="130" rx="8" className={BOX} />
      <circle cx="196" cy="62" r="20" fill="none" className="stroke-border" strokeWidth={9} />
      <circle cx="196" cy="62" r="20" fill="none" className="stroke-primary" strokeWidth={9} strokeDasharray="78 126" transform="rotate(-90 196 62)" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x="174" y={98 + i * 12} width={44 - i * 10} height="6" rx="3" className="fill-muted-foreground/60" />
      ))}
      <rect x="10" y="58" width="144" height="82" rx="8" className={BOX} />
      {[28, 44, 34, 58, 48, 66].map((h, i) => (
        <rect key={i} x={22 + i * 22} y={128 - h} width="14" height={h} rx="2" className={i === 5 ? ACCENT : "fill-muted-foreground/60"} />
      ))}
    </Svg>
  );
}

const VISUALS: Record<VisualKind, (p: P) => React.JSX.Element> = {
  flowchart: FlowchartVisual,
  mindmap: MindmapVisual,
  conceptmap: ConceptmapVisual,
  timeline: TimelineVisual,
  chart: ChartVisual,
  dashboard: DashboardVisual,
};

const LABELS: Record<VisualKind, string> = {
  flowchart: "Illustration of a flowchart with a decision step",
  mindmap: "Illustration of a mind map branching from one topic",
  conceptmap: "Illustration of a concept map with labelled links",
  timeline: "Illustration of a timeline with five milestones",
  chart: "Illustration of a bar and line chart",
  dashboard: "Illustration of a dashboard with figures and charts",
};

/** Framed illustration on a desk panel. */
export function Visual({ kind, className }: { kind: VisualKind; className?: string }) {
  const Comp = VISUALS[kind];
  return (
    <div className={cn("rounded-card border border-border bg-surface p-3", className)}>
      <Comp title={LABELS[kind]} className="h-auto w-full" />
    </div>
  );
}

/**
 * Hero composition: several visualisation types in one workspace, linked
 * together. Drawn, not captured: the caption says so and states what exists.
 */
export function WorkspaceIllustration({ className }: { className?: string }) {
  return (
    <figure className={className}>
      <div className="overflow-hidden rounded-card border border-border-strong bg-card shadow-overlay">
        <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2.5">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-border-strong" />
          <span aria-hidden="true" className="size-2.5 rounded-full bg-border-strong" />
          <span aria-hidden="true" className="size-2.5 rounded-full bg-border-strong" />
          <span className="ml-2 text-xs font-semibold text-muted-foreground">Product launch · one workspace</span>
        </div>
        <svg viewBox="0 0 640 330" role="img" aria-label="Illustration: a flowchart, a chart and a timeline connected in one workspace" className="block h-auto w-full bg-background">
          <g className="stroke-border-strong" strokeWidth={1.6} strokeDasharray="4 5" fill="none">
            <path d="M248 130 C 280 130, 280 70, 312 70" />
            <path d="M248 200 C 280 200, 280 258, 312 258" />
          </g>
          <circle cx="248" cy="130" r="4.5" className="fill-primary" />
          <circle cx="248" cy="200" r="4.5" className="fill-primary" />
          <rect x="16" y="16" width="232" height="298" rx="14" className="fill-surface stroke-border" />
          <FlowchartVisual x="22" y="70" width="220" height="188" />
          <text x="30" y="40" className="fill-foreground text-[12px]">Process</text>
          <rect x="312" y="16" width="312" height="140" rx="14" className="fill-surface stroke-border" />
          <text x="326" y="40" className="fill-foreground text-[12px]">Results</text>
          <ChartVisual x="316" y="44" width="304" height="108" />
          <rect x="312" y="190" width="312" height="124" rx="14" className="fill-surface stroke-border" />
          <text x="326" y="214" className="fill-foreground text-[12px]">Plan</text>
          <TimelineVisual x="316" y="212" width="304" height="100" />
        </svg>
      </div>
      <figcaption className="mt-3 text-sm text-muted-foreground">
        Illustration, not a screenshot. Flowcharts, mind maps, concept maps, timelines and charts all work today.
      </figcaption>
    </figure>
  );
}
