import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FolderPlus } from "lucide-react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { SaveStatus } from "@/components/shared/save-status";

function Harness({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <span data-testid="state">{open ? "open" : "closed"}</span>
      <ConfirmDialog open={open} onOpenChange={setOpen} title="Delete thing?" description="Gone forever." confirmLabel="Delete it" onConfirm={onConfirm} />
    </>
  );
}

describe("ConfirmDialog", () => {
  it("exposes an accessible alertdialog and does nothing until confirmed", async () => {
    const onConfirm = vi.fn(async () => undefined);
    render(<Harness onConfirm={onConfirm} />);
    expect(screen.getByRole("alertdialog", { name: "Delete thing?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByTestId("state")).toHaveTextContent("closed");
  });

  it("runs the action on confirm and closes", async () => {
    const onConfirm = vi.fn(async () => undefined);
    render(<Harness onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete it" }));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("closed"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("stays open when the action fails", async () => {
    const onConfirm = vi.fn(async () => {
      throw new Error("nope");
    });
    render(<Harness onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete it" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(screen.getByTestId("state")).toHaveTextContent("open");
  });

  it("is dismissible with Escape (cancel semantics)", async () => {
    const onConfirm = vi.fn(async () => undefined);
    render(<Harness onConfirm={onConfirm} />);
    await userEvent.keyboard("{Escape}");
    expect(screen.getByTestId("state")).toHaveTextContent("closed");
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("SaveStatus", () => {
  it.each([
    ["saved", "Saved"],
    ["unsaved", "Unsaved changes"],
    ["saving", "Saving…"],
    ["error", "Not saved"],
    ["conflict", "Conflict"],
  ] as const)("announces %s politely", (status, label) => {
    render(<SaveStatus state={{ status }} />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent(label);
  });
});

describe("EmptyState", () => {
  it("renders heading, description and action", () => {
    render(<EmptyState icon={FolderPlus} title="Nothing here" description="Add something." action={<button>Add</button>} />);
    expect(screen.getByRole("heading", { name: "Nothing here" })).toBeInTheDocument();
    expect(screen.getByText("Add something.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });
});

describe("ErrorBoundary", () => {
  function Boom({ explode }: { explode: boolean }) {
    if (explode) throw new Error("kaboom");
    return <p>fine</p>;
  }

  it("contains render errors, announces them, and recovers on reset", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { rerender } = render(
      <ErrorBoundary resetKey="a">
        <Boom explode />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("kaboom");
    rerender(
      <ErrorBoundary resetKey="b">
        <Boom explode={false} />
      </ErrorBoundary>,
    );
    expect(await screen.findByText("fine")).toBeInTheDocument();
  });
});
