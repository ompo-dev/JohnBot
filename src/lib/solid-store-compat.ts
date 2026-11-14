"use client";

export { createStore } from "./solid-react-compat";
export function reconcile<T>(val: T, _options?: any): any {
  const curried = (target?: any) => {
    if (target && typeof target === "object" && typeof val === "object" && val !== null) {
      if (Array.isArray(target) && Array.isArray(val)) {
        target.length = 0;
        target.push(...val);
        return target;
      }
      Object.assign(target, val);
      return target;
    }
    return val;
  };
  Object.assign(curried, val);
  return curried;
}

export function produce<T>(fn: (state: T) => void): (state: T) => T {
  return (state: T) => {
    const copy = Array.isArray(state) ? ([...state] as unknown as T) : ({ ...state } as T);
    fn(copy);
    return copy;
  };
}
