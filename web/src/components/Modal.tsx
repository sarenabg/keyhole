"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "./ui";

export function Modal({ title, onClose, children, width = 460 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="kh-fade fixed inset-0 z-50 flex items-end justify-center bg-[rgba(13,17,23,0.62)] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="kh-pop max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] bg-surface text-left text-ink shadow-pop outline-none sm:rounded-[24px]"
        style={{ maxWidth: width }}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHead({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="flex items-center gap-3 px-6 pt-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
      <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-subtle text-soft hover:bg-line">
        <CloseIcon size={16} stroke={2.4} />
      </button>
    </div>
  );
}
