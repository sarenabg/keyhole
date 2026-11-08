import type { KeyboardEvent } from "react";

/** Arrow keys move the choice in a radio group (and focus follows), as screen-reader users expect. */
export function radioKeys(count: number, current: number, pick: (i: number) => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (current + step + count) % count;
    pick(next);
    const radios = e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]');
    radios[next]?.focus();
  };
}
