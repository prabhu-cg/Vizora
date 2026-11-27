export type ChangeScope = "projects" | "visualisations" | "all";
export interface ChangeEvent {
  scope: ChangeScope;
  /** Entity id when a single record changed. */
  id?: string;
}
export type ChangeListener = (event: ChangeEvent) => void;

/**
 * Notifies subscribers about storage writes, in this tab and (via
 * BroadcastChannel) in other tabs, so lists stay fresh and editors can detect
 * that the document they hold has been superseded.
 */
export class ChangeBus {
  private listeners = new Set<ChangeListener>();
  private channel: BroadcastChannel | undefined;

  constructor(channelName = "vizora-storage") {
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(channelName);
      this.channel.onmessage = (message: MessageEvent<ChangeEvent>) => this.dispatch(message.data);
    }
  }

  subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: ChangeEvent): void {
    this.dispatch(event);
    try {
      this.channel?.postMessage(event);
    } catch {
      /* channel closed */
    }
  }

  close(): void {
    this.channel?.close();
    this.listeners.clear();
  }

  private dispatch(event: ChangeEvent): void {
    for (const listener of [...this.listeners]) listener(event);
  }
}
