import type { JSX } from "@solidjs/web";
import { type ClassValue as ClsxValue, clsx } from "clsx";
import { createSignal } from "solid-js";
import { twMerge } from "tailwind-merge";
import { useCallback, useRef } from "react";

export type ClassValue = ClsxValue;

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function cx(...values: (ClassValue | JSX.HTMLAttributes<HTMLElement>["class"])[]): string {
  return cn(...(values as ClassValue[]));
}

export function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const visibleLength = maxLength - 1;
  const startLength = Math.ceil((visibleLength * 2) / 3);
  const endLength = visibleLength - startLength;
  return `${value.slice(0, startLength)}…${value.slice(-endLength)}`;
}

/**
 * Whether the user asked for less animation. Import this instead of redeclaring it; several
 * modules once held their own copy under different names. `matchMedia` is optional for jsdom.
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** Whether the pointer is coarse and hoverless (touch screen). Kept beside `prefersReducedMotion`. */
export function usesTouchLayout(): boolean {
  return window.matchMedia?.("(hover: none), (pointer: coarse)").matches ?? false;
}

/** Constrains `value` to the inclusive range. */
export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/** Linear interpolation from `start` to `end`, for a `progress` an animation drives from 0 to 1. */
export function mix(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

/** Reads a CSS time custom property from the root element, in milliseconds. */
export function motionDuration(name: string, fallback: number): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (value.endsWith("ms")) return Number.parseFloat(value) || fallback;
  if (value.endsWith("s")) return (Number.parseFloat(value) || fallback / 1_000) * 1_000;
  return Number.parseFloat(value) || fallback;
}

/**
 * Sound cue for a trigger that opens and closes its popup on pointerdown, such as a menu or a select.
 * The click that plays the cue comes after the change, so keep the state that the pointerdown found:
 * `close` when the popup was open. Put `cue()` on `data-cuelume-open` and add `ref` to the trigger.
 */
export function createPressedPopupCue(): { ref: (element: HTMLElement | null) => void; cue: () => string } {
  const [closing, setClosing] = createSignal(false);
  const previous = useRef<HTMLElement | null>(null);
  const onPointerDown = useCallback((event: Event) => {
    const element = event.currentTarget as HTMLElement;
    setClosing(element.getAttribute("aria-expanded") === "true");
  }, [setClosing]);
  const ref = useCallback((element: HTMLElement | null) => {
    previous.current?.removeEventListener("pointerdown", onPointerDown, true);
    previous.current = element;
    element?.addEventListener("pointerdown", onPointerDown, true);
  }, [onPointerDown]);
  return {
    ref,
    cue: () => (closing() ? "close" : ""),
  };
}
