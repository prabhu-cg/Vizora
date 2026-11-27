"use client";

import { Maximize, Minimize, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { Chrome } from "./use-workspace-chrome";

export interface FramePanel {
  /** Names the panel for assistive technology and for its show/hide buttons. */
  label: string;
  /** The label on the small-screen switcher. */
  tab: string;
  node: ReactNode;
}

/** Show/hide buttons for the side panels and the full-screen canvas. Used by every workspace toolbar. */
export function PanelControls({ chrome, left, right }: { chrome: Chrome; left: string; right: string }) {
  return (
    <>
      <Button variant="ghost" size="icon" className="hidden size-9 lg:inline-flex" aria-pressed={chrome.leftOpen} aria-label={`${chrome.leftOpen ? "Hide" : "Show"} ${left} panel ([)`} title={`${chrome.leftOpen ? "Hide" : "Show"} ${left} panel ([)`} onClick={chrome.toggleLeft}>
        {chrome.leftOpen ? <PanelLeftClose aria-hidden="true" /> : <PanelLeftOpen aria-hidden="true" />}
      </Button>
      <Button variant="ghost" size="icon" className="hidden size-9 lg:inline-flex" aria-pressed={chrome.rightOpen} aria-label={`${chrome.rightOpen ? "Hide" : "Show"} ${right} panel (])`} title={`${chrome.rightOpen ? "Hide" : "Show"} ${right} panel (])`} onClick={chrome.toggleRight}>
        {chrome.rightOpen ? <PanelRightClose aria-hidden="true" /> : <PanelRightOpen aria-hidden="true" />}
      </Button>
      <Button variant="ghost" size="icon" className="size-9" aria-pressed={chrome.focus} aria-label="Full-screen canvas (F)" title="Full-screen canvas (F)" onClick={chrome.toggleFocus}>
        {chrome.focus ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />}
      </Button>
    </>
  );
}

function Side({ side, panel, chrome, mobileShown, id }: { side: "left" | "right"; panel: FramePanel; chrome: Chrome; mobileShown: boolean; id: string }) {
  const open = side === "left" ? chrome.leftOpen : chrome.rightOpen;
  const toggle = side === "left" ? chrome.toggleLeft : chrome.toggleRight;
  const Close = side === "left" ? PanelLeftClose : PanelRightClose;
  const Open = side === "left" ? PanelLeftOpen : PanelRightOpen;
  return (
    <aside
      id={id}
      aria-label={panel.label}
      data-state={open ? "open" : "collapsed"}
      className={cn("min-h-0 min-w-0 overflow-hidden bg-surface", side === "left" ? "border-r border-border" : "border-l border-border", mobileShown && !chrome.focus ? "block" : "hidden", !chrome.focus && "lg:block")}
    >
      {/* Desktop, collapsed: a slim rail with one button to bring the panel back. */}
      {!open && (
        <div className="hidden h-full flex-col items-center pt-2 lg:flex">
          <Button variant="ghost" size="icon" className="size-9" aria-expanded={false} aria-controls={id} aria-label={`Show ${panel.label} panel`} title={`Show ${panel.label} panel`} onClick={toggle}>
            <Open aria-hidden="true" />
          </Button>
        </div>
      )}
      <div className={cn("h-full min-h-0 flex-col", open ? "flex" : "flex lg:hidden")}>
        <div className="hidden items-center justify-between border-b border-border px-3 py-1 lg:flex">
          <span className="text-xs font-semibold text-muted-foreground">{panel.label}</span>
          <Button variant="ghost" size="icon" className="size-8" aria-expanded={open} aria-controls={id} aria-label={`Hide ${panel.label} panel`} title={`Hide ${panel.label} panel`} onClick={toggle}>
            <Close aria-hidden="true" />
          </Button>
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] [overflow-wrap:anywhere]">{panel.node}</div>
      </div>
    </aside>
  );
}

/**
 * The three-panel workspace layout shared by every editor: a left panel, the
 * canvas, a right panel. Desktop panels collapse to a rail (remembered); small
 * screens show one panel at a time; full-screen mode leaves only the canvas.
 */
export function WorkspaceFrame({ chrome, left, right, centre, centreLabel }: { chrome: Chrome; left: FramePanel; right: FramePanel; centre: ReactNode; centreLabel: string }) {
  const [shown, setShown] = useState<"canvas" | "left" | "right">("canvas");
  const cols = chrome.focus ? "0px minmax(0,1fr) 0px" : `${chrome.leftOpen ? "18rem" : "2.75rem"} minmax(0,1fr) ${chrome.rightOpen ? "20rem" : "2.75rem"}`;
  const tabs = [
    { id: "canvas" as const, label: centreLabel },
    { id: "left" as const, label: left.tab },
    { id: "right" as const, label: right.tab },
  ];
  return (
    <>
      {!chrome.focus && (
        <div role="group" aria-label="Workspace panels" className="flex border-b border-border bg-surface lg:hidden">
          {tabs.map((t) => (
            <button key={t.id} type="button" aria-pressed={shown === t.id} onClick={() => setShown(t.id)} className={cn("min-h-11 flex-1 border-b-2 px-3 text-sm font-medium", shown === t.id ? "border-primary text-primary-text" : "border-transparent text-muted-foreground")}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div className="grid min-h-0 flex-1 transition-[grid-template-columns] duration-200 lg:grid-cols-[var(--cols)]" style={{ "--cols": cols } as React.CSSProperties}>
        <Side side="left" id="workspace-left" panel={left} chrome={chrome} mobileShown={shown === "left"} />
        <div className={cn("min-h-0 min-w-0", shown === "canvas" || chrome.focus ? "block" : "hidden", "lg:block")}>{centre}</div>
        <Side side="right" id="workspace-right" panel={right} chrome={chrome} mobileShown={shown === "right"} />
      </div>
    </>
  );
}
