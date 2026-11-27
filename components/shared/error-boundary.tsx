"use client";

import { reportError } from "@/lib/logging";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "./error-state";

interface Props {
  children: ReactNode;
  /** Changing this value clears a caught error (e.g. when the document changes). */
  resetKey?: unknown;
  title?: string;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

/** Contains render failures (e.g. a renderer choking on odd data) to one region. */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, `component boundary${info.componentStack ? ` in ${info.componentStack.trim().split("\n")[0]}` : ""}`);
  }

  override componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  reset = () => this.setState({ error: null });

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return <ErrorState title={this.props.title} message={error.message} onRetry={this.reset} />;
  }
}
