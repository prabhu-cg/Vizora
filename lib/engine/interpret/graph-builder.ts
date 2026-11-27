import type { SemanticGraph, SemanticItem, SemanticLink, Warning } from "./types";

/** Collects items, links and warnings with deterministic ids (n1, n2, …). */
export class GraphBuilder {
  items: SemanticItem[] = [];
  links: SemanticLink[] = [];
  warnings: Warning[] = [];
  private seq = 0;

  add(item: Omit<SemanticItem, "id">): SemanticItem {
    const full = { id: `n${++this.seq}`, ...item };
    this.items.push(full);
    return full;
  }

  link(from: string, to: string, label?: string, directed?: boolean): void {
    if (from === to && !label) return;
    if (this.links.some((l) => l.from === from && l.to === to && l.label === label)) return;
    this.links.push({ from, to, ...(label ? { label } : {}), ...(directed === false ? { directed: false } : {}) });
  }

  warn(code: string, message: string, line?: number, severity: Warning["severity"] = "warning"): void {
    this.warnings.push({ code, message, line, severity });
  }

  get(id: string): SemanticItem | undefined {
    return this.items.find((i) => i.id === id);
  }

  graph(type: SemanticGraph["type"], title: string, layoutHint?: SemanticGraph["layoutHint"]): SemanticGraph {
    return { type, title, items: this.items, links: this.links, ...(layoutHint ? { layoutHint } : {}) };
  }
}
