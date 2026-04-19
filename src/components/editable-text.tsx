"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Notion-style inline editable text: clicking turns into a textarea that
 * auto-resizes. onChange fires on blur/commit. Empty state shows placeholder.
 */
export function EditableText({
  value,
  onChange,
  placeholder = "—",
  className,
  multiline = true,
  monospace = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  monospace?: boolean;
}) {
  const [local, setLocal] = React.useState(value);
  const taRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => setLocal(value), [value]);

  const resize = React.useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 600) + "px";
  }, []);

  React.useEffect(() => {
    resize();
  }, [local, resize]);

  const commit = () => {
    if (local !== value) onChange(local);
  };

  if (!multiline) {
    return (
      <input
        value={local}
        placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        className={cn(
          "w-full rounded-md bg-transparent px-2 py-1 text-sm outline-none ring-1 ring-inset ring-transparent transition-all",
          "hover:bg-accent/40 focus:bg-background focus:ring-ring",
          monospace && "font-mono",
          className
        )}
      />
    );
  }

  return (
    <textarea
      ref={taRef}
      rows={1}
      value={local}
      placeholder={placeholder}
      onChange={(e) => {
        setLocal(e.target.value);
        resize();
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          commit();
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      className={cn(
        "w-full resize-none rounded-md bg-transparent px-2 py-1 text-sm leading-relaxed outline-none ring-1 ring-inset ring-transparent transition-all",
        "hover:bg-accent/40 focus:bg-background focus:ring-ring",
        monospace && "font-mono",
        className
      )}
    />
  );
}
