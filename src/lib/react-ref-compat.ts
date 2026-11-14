import { useCallback, useRef } from "react";

export function setCompatibleRef(ref: any, element: any): void {
  if (Array.isArray(ref)) {
    for (const entry of ref) setCompatibleRef(entry, element);
  } else if (typeof ref === "function") {
    ref(element);
  } else if (ref && typeof ref === "object") {
    ref.current = element;
  }
}

/** Keep Radix's composed DOM ref stable while Solid-style callback arrays change. */
export function useCompatibleRef(ref: any) {
  const latest = useRef(ref);
  latest.current = ref;
  return useCallback((element: any) => setCompatibleRef(latest.current, element), []);
}
