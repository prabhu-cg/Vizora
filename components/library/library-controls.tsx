"use client";

import { Search, X } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** A labelled search box with a clear button. */
export function SearchBox({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string }) {
  const id = useId();
  return (
    <div className="relative min-w-0 flex-1 sm:max-w-md">
      <Label htmlFor={id} className="sr-only">{label}</Label>
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input id={id} type="search" value={value} placeholder={placeholder ?? label} onChange={(e) => onChange(e.target.value)} className="pl-9 pr-10 [&::-webkit-search-cancel-button]:hidden" autoComplete="off" />
      {value && (
        <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 size-8 -translate-y-1/2" aria-label="Clear search" onClick={() => onChange("")}>
          <X aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

export function SortSelect<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: Record<T, string> }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="shrink-0 text-muted-foreground">{label}</Label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className="h-10 w-auto">
        {(Object.keys(options) as T[]).map((k) => (
          <option key={k} value={k}>{options[k]}</option>
        ))}
      </Select>
    </div>
  );
}
