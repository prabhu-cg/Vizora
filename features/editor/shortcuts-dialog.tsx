"use client";

import { Drawer, DrawerBody, DrawerContent, DrawerHeader } from "@/components/ui/drawer";
import { SHORTCUTS } from "./shortcuts";

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent size="md">
        <DrawerHeader title="Keyboard shortcuts" description="Everything you can do with the pointer can also be done from the keyboard and the Inspector panel." />
        <DrawerBody>
          <dl className="grid gap-4">
            {SHORTCUTS.map((s) => (
              <div key={s.action} className="grid gap-1 border-b border-border pb-3 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-6">
                <dt className="text-sm text-body">{s.label}</dt>
                <dd>
                  <kbd className="rounded-input border border-border-strong bg-surface px-2 py-1 font-mono text-xs text-foreground">{s.keys}</kbd>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-sm text-muted-foreground">
            Shortcuts work when the canvas has focus. While you are typing in a field they are off, so text editing behaves normally. Tab always moves
            through the page unless an item on the canvas has focus.
          </p>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
