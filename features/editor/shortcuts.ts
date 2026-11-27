/** Keyboard shortcuts for the editor, as data so the help dialog and the handler can never disagree. */
export type ShortcutAction =
  | "undo" | "redo" | "duplicate" | "delete" | "edit" | "add-child" | "add-sibling" | "fit" | "zoom-in" | "zoom-out" | "deselect" | "help" | "select-all";

export interface ShortcutDef {
  action: ShortcutAction;
  keys: string;
  label: string;
}

export const SHORTCUTS: ShortcutDef[] = [
  { action: "undo", keys: "Ctrl/⌘ + Z", label: "Undo" },
  { action: "redo", keys: "Ctrl/⌘ + Shift + Z  or  Ctrl + Y", label: "Redo" },
  { action: "duplicate", keys: "Ctrl/⌘ + D", label: "Duplicate selection" },
  { action: "delete", keys: "Delete  or  Backspace", label: "Delete selection" },
  { action: "edit", keys: "Enter  or  F2", label: "Edit the selected item's text" },
  { action: "add-child", keys: "Tab", label: "Add a connected item after the selected one (child, next step, next event)" },
  { action: "add-sibling", keys: "Alt + Enter", label: "Mind map: add a sibling branch" },
  { action: "select-all", keys: "Ctrl/⌘ + A", label: "Select everything" },
  { action: "fit", keys: "Ctrl/⌘ + 0", label: "Fit to screen" },
  { action: "zoom-in", keys: "+", label: "Zoom in" },
  { action: "zoom-out", keys: "−", label: "Zoom out" },
  { action: "deselect", keys: "Escape", label: "Cancel editing / clear selection" },
  { action: "help", keys: "?", label: "Show this list" },
];

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** Map a key event to an action. Pure; whether to *apply* it (focus, dialogs) is decided by the caller. */
export function matchShortcut(e: KeyLike): ShortcutAction | undefined {
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (mod && !e.altKey) {
    if (k === "z") return e.shiftKey ? "redo" : "undo";
    if (k === "y") return "redo";
    if (k === "d") return "duplicate";
    if (k === "0") return "fit";
    if (k === "a") return "select-all";
    return undefined;
  }
  if (e.altKey && k === "Enter") return "add-sibling";
  if (e.altKey || e.metaKey || e.ctrlKey) return undefined;
  switch (k) {
    case "Delete":
    case "Backspace":
      return "delete";
    case "Enter":
    case "F2":
      return "edit";
    case "Tab":
      return e.shiftKey ? undefined : "add-child";
    case "Escape":
      return "deselect";
    case "+":
    case "=":
      return "zoom-in";
    case "-":
    case "_":
      return "zoom-out";
    case "?":
      return "help";
    default:
      return undefined;
  }
}

const TEXT_TARGETS = "input, textarea, select, [contenteditable=''], [contenteditable='true']";

/**
 * Shortcuts apply when focus is in the canvas (or nowhere), never while typing
 * in a field or when a dialog is open, and Tab/Enter/Delete only when a canvas
 * item has focus, so normal keyboard navigation of the page is never trapped.
 */
export function shouldHandle(action: ShortcutAction, target: EventTarget | null, doc: Document): boolean {
  const el = target instanceof Element ? target : null;
  if (el?.closest(TEXT_TARGETS)) return false; // text fields keep their own undo, typing and arrow keys
  if (doc.querySelector('[role="dialog"], [role="alertdialog"]')) return false;
  const inCanvas = !!el?.closest("[data-editor-canvas]");
  const onBody = !el || el === doc.body;
  if (action === "undo" || action === "redo" || action === "help" || action === "fit") return inCanvas || onBody;
  if (action === "add-child" || action === "edit" || action === "delete" || action === "add-sibling" || action === "duplicate" || action === "select-all") return inCanvas || (onBody && action !== "add-child");
  return inCanvas || onBody;
}
