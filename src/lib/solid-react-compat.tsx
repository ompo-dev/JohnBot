"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useId,
  lazy as rcLazy,
  createContext as rcCreateContext,
  useContext as rcUseContext,
  type ReactNode,
  type ComponentType,
} from "react";

// Track render depth to know if we're inside a component
let _renderDepth = 0;

/**
 * Must be called at the top of every component that uses solid-compat primitives.
 * We also hook into React via a tiny wrapper approach below.
 */
function isInsideComponent(): boolean {
  return _renderDepth > 0;
}

/**
 * Hook that marks we are inside a React component render.
 * Call this at the start of createSignal/createStore/createMemo
 * when we're sure we're in a component.
 * 
 * Alternative approach: try/catch useState.
 */
function tryUseState<T>(init: T): [boolean, T, React.Dispatch<React.SetStateAction<T>>] {
  try {
    const [val, setVal] = useState<T>(init);
    return [true, val, setVal];
  } catch {
    return [false, init, (() => {}) as any];
  }
}

// Accessor & Setter types
export type Accessor<T> = () => T;
export type Setter<T> = (val: T | ((prev: T) => T)) => void;
export type Element = ReactNode;
export type ParentProps<P = {}> = P & { children?: ReactNode };

/** React Signal Implementation supporting both component and module-level invocation */
export function createSignal<T>(initial?: T | (() => T), _options?: any): [Accessor<T>, Setter<T>] {
  try {
    const [val, setVal] = useState<T>(initial as any);
    const valRef = useRef(val);
    valRef.current = val;
    const getter = useCallback(() => valRef.current, []) as Accessor<T>;
    (getter as any)[IS_ACCESSOR] = true;
    const setter = useCallback((next: any) => {
      const nextVal = typeof next === "function" ? next(valRef.current) : next;
      if (Object.is(valRef.current, nextVal)) return;
      if (
        typeof valRef.current === "object" &&
        valRef.current !== null &&
        typeof nextVal === "object" &&
        nextVal !== null
      ) {
        const k1 = Object.keys(valRef.current);
        const k2 = Object.keys(nextVal);
        if (k1.length === k2.length && k1.every((k) => Object.is((valRef.current as any)[k], (nextVal as any)[k]))) {
          return;
        }
      }
      valRef.current = nextVal;
      setVal(nextVal);
    }, []) as Setter<T>;
    return [getter, setter];
  } catch {
    // Module-level / outside component — hooks not available
    let currentVal = typeof initial === "function" ? (initial as Function)() : (initial as T);
    const getter = (() => currentVal) as Accessor<T>;
    (getter as any)[IS_ACCESSOR] = true;
    const setter = ((nextVal: any) => {
      const resolved = typeof nextVal === "function" ? nextVal(currentVal) : nextVal;
      if (Object.is(currentVal, resolved)) return;
      currentVal = resolved;
    }) as Setter<T>;
    return [getter, setter];
  }
}

/** React Memo Implementation */
export function createMemo<T>(fn: () => T, _value?: any, _options?: any): Accessor<T> {
  let valRef: React.MutableRefObject<T | undefined>;
  try {
    // Registers a hook, so the hook order stays stable even when the memo throws.
    valRef = useRef<T | undefined>(undefined);
  } catch {
    // Module-level / outside component — hooks are not available.
    const getter = (() => {
      try {
        return fn();
      } catch {
        return undefined as T;
      }
    }) as Accessor<T>;
    (getter as any)[IS_ACCESSOR] = true;
    return getter;
  }
  try {
    valRef.current = fn();
  } catch {
    // Keep the last value while the data is not ready.
  }
  const getter = useCallback(() => valRef.current as T, []) as Accessor<T>;
  (getter as any)[IS_ACCESSOR] = true;
  return getter;
}

/** React Effect Implementation — supports both createEffect(fn) and createEffect(depsFn, effectFn) */
export function createEffect(fnOrDeps: any, effectFn?: any) {
  if (effectFn !== undefined) {
    // Solid overload: createEffect(depsFn, effectFn)
    // depsFn returns tracked value, effectFn receives (next, previous)
    try {
      const prevValRef = useRef<any>(undefined);
      const hasRunRef = useRef(false);
      const cleanupRef = useRef<(() => void) | undefined>(undefined);

      useEffect(() => () => {
        cleanupRef.current?.();
        cleanupRef.current = undefined;
        hasRunRef.current = false;
      }, []);

      useEffect(() => {
        let nextVal: any;
        try {
          nextVal = typeof fnOrDeps === "function" ? fnOrDeps() : fnOrDeps;
        } catch {
          return;
        }

        const prevVal = prevValRef.current;
        let changed = false;

        if (!hasRunRef.current) {
          changed = true;
        } else if (Object.is(nextVal, prevVal)) {
          changed = false;
        } else if (
          typeof nextVal === "object" &&
          nextVal !== null &&
          typeof prevVal === "object" &&
          prevVal !== null
        ) {
          const k1 = Object.keys(nextVal);
          const k2 = Object.keys(prevVal);
          if (k1.length !== k2.length) {
            changed = true;
          } else {
            changed = k1.some((k) => !Object.is(nextVal[k], prevVal[k]));
          }
        } else {
          changed = true;
        }

        if (changed) {
          hasRunRef.current = true;
          prevValRef.current = nextVal;
          try {
            cleanupRef.current?.();
            cleanupRef.current = undefined;
            const cleanup = effectFn(nextVal, prevVal);
            if (typeof cleanup === "function") cleanupRef.current = cleanup;
          } catch (err) {
            console.error("Error in createEffect effectFn:", err);
          }
        }
      });
    } catch {
      try {
        const deps = typeof fnOrDeps === "function" ? fnOrDeps() : fnOrDeps;
        effectFn(deps, undefined);
      } catch (e) {
        console.error(e);
      }
    }
    return;
  }
  // Single-arg: createEffect(fn)
  try {
    const runCountRef = useRef(0);
    const lastTimeRef = useRef(Date.now());

    useEffect(() => {
      const now = Date.now();
      if (now - lastTimeRef.current < 80) {
        runCountRef.current++;
        if (runCountRef.current > 30) {
          return;
        }
      } else {
        runCountRef.current = 1;
        lastTimeRef.current = now;
      }

      const cleanup = fnOrDeps();
      return () => {
        if (typeof cleanup === "function") cleanup();
      };
    });
  } catch {
    try {
      fnOrDeps();
    } catch (e) {
      console.error(e);
    }
  }
}

export function onCleanup(fn: () => void) {
  try {
    useEffect(() => {
      return () => {
        fn();
      };
    }, []);
  } catch {
    // outside component, no cleanup needed
  }
}

export function onSettled<T>(fn: () => T): void {
  try {
    useEffect(() => {
      const cleanup = fn();
      if (typeof cleanup === "function") return cleanup as any;
    }, []);
  } catch {
    // outside component — just run it
    fn();
  }
}

export function batch<T>(fn: () => T): T {
  return fn();
}

export function untrack<T>(fn: () => T): T {
  return fn();
}

export function createRoot<T>(fn: (dispose: () => void) => T): T {
  return fn(() => {});
}

export function createUniqueId(): string {
  try {
    return useId();
  } catch {
    return "uid-" + Math.random().toString(36).substring(2, 9);
  }
}

export const createContext = rcCreateContext;
export const useContext = rcUseContext;
export const lazy = rcLazy;

export function children(fn: () => any) {
  // Espelha o `children` do Solid: resolve funções/aninhamentos e expõe
  // `.toArray()` no memo e no valor (o código do openbot chama `.toArray()`).
  const resolve = (v: any, depth: number): any => {
    if (depth > 8) return [];
    while (typeof v === "function" && !(v as any).toArray) v = (v as any)();
    if (Array.isArray(v)) return v.flatMap((item) => resolve(item, depth + 1));
    if (v === null || v === undefined || typeof v === "boolean") return [];
    return [v];
  };
  const memo: any = () => {
    let arr: any[] = [];
    try {
      arr = React.Children.toArray(resolve(fn(), 0));
    } catch {
      arr = [];
    }
    Object.defineProperty(arr, "toArray", { value: () => arr.slice(), enumerable: false });
    return arr;
  };
  memo.toArray = () => {
    const arr = memo();
    return arr.slice();
  };
  return memo;
}

export function mapArray<T, U>(list: () => readonly T[] | undefined | null, mapFn: (v: T, i: Accessor<number>) => U): Accessor<U[]> {
  return () => {
    const arr = list();
    if (!arr) return [];
    return arr.map((item, idx) => mapFn(makeSolidAccessor(item), () => idx));
  };
}

export function getOwner(): any {
  return null;
}

export function runWithOwner<T>(_owner: any, fn: () => T): T {
  return fn();
}

export function flush<T>(callback?: () => T): T | undefined { return callback?.(); }

export function isDisposed(): boolean {
  return false;
}

export function createProjection<T>(fn: () => T): Accessor<T> {
  return createMemo(fn);
}

export function snapshot<T>(val: T): T {
  return val;
}

class ErroredBoundary extends React.Component<
  { fallback?: ReactNode; children?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown, info: unknown) {
    console.error("Errored boundary:", error, info);
  }
  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}

/** Solid-compat stand-in for the error boundary the sources wrap rows in. */
export const Errored = ErroredBoundary;

/** Solid-compat stand-in for the suspense boundary the sources wrap lazy views in. */
export function Loading(props: { fallback?: ReactNode; children?: ReactNode }): ReactNode {
  return <React.Suspense fallback={props.fallback ?? null}>{props.children}</React.Suspense>;
}

// --- Store Implementation ---
export type Store<T> = T;
export type StoreSetter<T> = (action: any) => void;

/** Apply a store action: supports produce-style mutation (fn returns undefined), 
 *  functional update (fn returns new value), or plain object merge */
export function applyStoreAction<T extends object>(prev: T, action: any): T {
  if (typeof action === "function") {
    const copy = cloneStoreData(prev);
    const result = action(copy);
    // If the function returns undefined, it mutated the copy in place (produce-style)
    return shareStoreData(prev, result !== undefined ? result : copy);
  }
  if (action && typeof action === "object") {
    return shareStoreData(prev, { ...prev, ...action });
  }
  return prev;
}

function isStoreData(value: any): boolean {
  return value !== null && typeof value === "object" &&
    (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function cloneStoreData<T>(value: T, seen = new WeakMap<object, any>()): T {
  if (!isStoreData(value)) return value;
  if (seen.has(value as object)) return seen.get(value as object);
  const copy: any = Array.isArray(value) ? new Array(value.length) : Object.create(Object.getPrototypeOf(value));
  seen.set(value as object, copy);
  for (const key of Object.keys(value as object)) copy[key] = cloneStoreData((value as any)[key], seen);
  return copy;
}

function shareStoreData<T>(previous: T, next: T, seen = new WeakMap<object, any>()): T {
  if (Object.is(previous, next) || !isStoreData(previous) || !isStoreData(next)) return next;
  if (Array.isArray(previous) !== Array.isArray(next)) return next;
  if (seen.has(next as object)) return seen.get(next as object);
  seen.set(next as object, next);
  const keys = Object.keys(next as object);
  let same = keys.length === Object.keys(previous as object).length &&
    (!Array.isArray(next) || next.length === (previous as any).length);
  for (const key of keys) {
    (next as any)[key] = shareStoreData((previous as any)[key], (next as any)[key], seen);
    if (!Object.prototype.hasOwnProperty.call(previous, key) || !Object.is((previous as any)[key], (next as any)[key])) same = false;
  }
  return same ? previous : next;
}

let inStoreSetter = false;

export function createStore<T extends object>(init: T): [T, (action: any) => void] {
  if (inStoreSetter) {
    let currentVal: T = init;
    const setter = (action: any) => {
      currentVal = applyStoreAction(currentVal, action);
    };
    return [currentVal, setter];
  }
  try {
    const [val, setVal] = useState<T>(init);
    const setter = useCallback((action: any) => {
      setVal((prev) => {
        const wasInStoreSetter = inStoreSetter;
          inStoreSetter = true;
          try {
            const next = applyStoreAction(prev, action);
            if (Object.is(prev, next)) return prev;
            return next;
          } finally {
            inStoreSetter = wasInStoreSetter;
          }
        });
      }, []);
    return [val, setter];
  } catch {
    // Module-level / outside component — hooks not available (any error = not in component)
    let currentVal = init;
    const setter = (action: any) => {
      currentVal = applyStoreAction(currentVal, action);
    };
    return [currentVal, setter];
  }
}

/** Solid's `reconcile(value, key)`: a store setter that merges `value` into the target in place. */
export function reconcile<T>(value: T, keyOrOptions?: any): any {
  return (target: any) => {
    if (Array.isArray(value)) {
      if (Array.isArray(target)) {
        target.length = 0;
        target.push(...value);
      }
      return target;
    }
    if (value && typeof value === "object" && target && typeof target === "object") {
      for (const k of Object.keys(target)) {
        if (!(k in (value as any))) delete target[k];
      }
      Object.assign(target, value);
      return target;
    }
    return value;
  };
}

export function produce<T>(fn: (state: T) => void) {
  return (state: T) => {
    const copy = Array.isArray(state) ? [...state] : { ...state };
    fn(copy as any);
    return copy;
  };
}

// Props utilities
export function merge<T extends object>(...sources: (Partial<T> | (() => Partial<T>))[]): T {
  const target: any = {};
  for (const src of sources) {
    const resolved = typeof src === "function" ? (src as Function)() : src;
    if (resolved && typeof resolved === "object") {
      Object.assign(target, resolved);
    }
  }
  return target as T;
}

export function omit<T extends object, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> {
  const copy: any = { ...obj };
  for (const k of keys) {
    delete copy[k];
  }
  return copy;
}

export function splitProps<T extends object, K extends keyof T>(
  props: T,
  ...keyGroups: K[][]
): any[] {
  const result: any[] = [];
  const assigned = new Set<string>();

  for (const group of keyGroups) {
    const sub: any = {};
    for (const key of group) {
      if (key in props) {
        sub[key] = (props as any)[key];
        assigned.add(String(key));
      }
    }
    result.push(sub);
  }

  const remainder: any = {};
  for (const key of Object.keys(props)) {
    if (!assigned.has(key)) {
      remainder[key] = (props as any)[key];
    }
  }
  result.push(remainder);
  return result;
}

// --- Solid Control Flow in React ---

export const IS_ACCESSOR: unique symbol = Symbol("IS_ACCESSOR");

export function isAccessor(val: any): boolean {
  return typeof val === "function" && Boolean(val[IS_ACCESSOR]);
}

function makeSolidAccessor<T>(val: T): any {
  if (isAccessor(val)) return val;
  const fn = () => val;
  (fn as any)[IS_ACCESSOR] = true;
  fn.toString = () => String(val);
  fn.valueOf = () => val;
  (fn as any)[Symbol.toPrimitive] = () => val;
  return new Proxy(fn, {
    apply(_target, _thisArg, _argList) {
      return val;
    },
    get(target, prop, receiver) {
      if (prop === IS_ACCESSOR) return true;
      if (prop === Symbol.toPrimitive) return () => val;
      if (prop === "toString") return () => String(val);
      if (prop === "valueOf") return () => val;
      if (prop in target) {
        return Reflect.get(target, prop, receiver);
      }
      if (val && typeof val === "object" && prop in (val as any)) {
        const propVal = (val as any)[prop];
        return typeof propVal === "function" ? propVal.bind(val) : propVal;
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export interface ShowProps<T = any> {
  when: T | undefined | null | false;
  fallback?: ReactNode;
  children: ReactNode | ((item: NonNullable<T>) => ReactNode);
  keyed?: boolean;
}

// Render callbacks can contain Solid primitives backed by React hooks.
// Each callback needs its own fiber so branches and list sizes cannot change a parent's hook order.
function ControlFlowContent({ render, args }: { render: Function; args: any[] }): ReactNode {
  return cleanVNode(render(...args));
}

export function Show<T>({ when, fallback = null, children, keyed }: ShowProps<T>): ReactNode {
  const isConditionMet = isAccessor(when) ? (when as Function)() : when;

  if (isConditionMet) {
    if (typeof children === "function") {
      return <ControlFlowContent render={children} args={[keyed ? isConditionMet : makeSolidAccessor(isConditionMet)]} />;
    }
    return children as ReactNode;
  }
  return fallback;
}

export interface ForProps<T> {
  each: readonly T[] | undefined | null;
  fallback?: ReactNode;
  children: (item: T, index: Accessor<number>) => ReactNode;
}

function filterUndefinedChildren(children: any): any {
  if (!children) return children;
  if (Array.isArray(children)) {
    return children
      .filter((c) => !(React.isValidElement(c) && c.type === undefined))
      .map((c, i) => {
        const cleaned = cleanVNode(c);
        if (React.isValidElement(cleaned) && cleaned.key === null) {
          return React.cloneElement(cleaned, { key: `c-${i}` });
        }
        return cleaned;
      });
  }
  if (React.isValidElement(children) && children.type === undefined) {
    return null;
  }
  return cleanVNode(children);
}

function cleanVNode(node: any): any {
  if (!node || typeof node !== "object") return node;
  if (React.isValidElement(node)) {
    if (node.type === undefined) {
      console.error("VNODE COM TYPE UNDEFINED IGNORADO! Props:", node.props);
      return null;
    }
    if (node.props && (node.props as any).children) {
      const cleaned = filterUndefinedChildren((node.props as any).children);
      if (cleaned !== (node.props as any).children) {
        return React.cloneElement(node, undefined, ...(Array.isArray(cleaned) ? cleaned : [cleaned]));
      }
    }
  }
  return node;
}

export interface ForProps<T> {
  each: readonly T[] | undefined | null;
  fallback?: ReactNode;
  children: (item: T, index: Accessor<number>) => ReactNode;
  keyed?: boolean | ((item: T) => any);
}

export function For<T>({ each, fallback = null, children, keyed }: ForProps<T>): ReactNode {
  const list = isAccessor(each) ? (each as Function)() : each;
  if (!list || list.length === 0) return fallback;
  return (
    <>
      {list.map((item: any, idx: number) => {
        const indexAccessor = () => idx;
        const indexArg = keyed === false ? idx : indexAccessor;
        const itemArg = keyed === false || typeof keyed === "function" ? makeSolidAccessor(item) : item;
        let keyVal: any = idx;
        if (typeof keyed === "function") {
          try {
            keyVal = keyed(item) ?? idx;
          } catch {
            keyVal = idx;
          }
        } else if (item && typeof item === "object" && (item as any).id !== undefined) {
          keyVal = (item as any).id;
        }
        return <ControlFlowContent key={keyVal} render={children} args={[itemArg, indexArg]} />;
      })}
    </>
  );
}

export interface MatchProps<T = any> {
  when: T | undefined | null | false;
  children: ReactNode | ((item: NonNullable<T>) => ReactNode);
}

export function Match<T>({ children }: MatchProps<T>): ReactNode {
  return children as ReactNode;
}

export interface SwitchProps {
  fallback?: ReactNode;
  children: ReactNode;
}

export function Switch({ fallback = null, children }: SwitchProps): ReactNode {
  const childrenArray = React.Children.toArray(children);
  for (const child of childrenArray) {
    if (React.isValidElement(child)) {
      const childProps = child.props as any;
      const condition = isAccessor(childProps.when) ? childProps.when() : childProps.when;
      if (condition) {
        if (typeof childProps.children === "function") {
          return <ControlFlowContent key={child.key} render={childProps.children} args={[
            childProps.keyed ? condition : makeSolidAccessor(condition),
            childProps.keyed === false ? undefined : () => 0,
          ]} />;
        }
        return childProps.children;
      }
    }
  }
  return fallback;
}

export interface DynamicProps {
  component: ComponentType<any> | string;
  [key: string]: any;
}

export function Dynamic({ component: Component, ...props }: DynamicProps): ReactNode {
  if (!Component) return null;
  const Resolved = isAccessor(Component) ? (Component as any)() : Component;
  if (!Resolved) return null;
  if (typeof Resolved !== "function" && typeof Resolved !== "string") {
    if (Resolved && typeof Resolved === "object") {
      const FallbackComp = (Resolved as any).Root || (Resolved as any).default;
      if (typeof FallbackComp === "function" || typeof FallbackComp === "string") {
        return <FallbackComp {...props} />;
      }
    }
    return null;
  }
  return <Resolved {...props} />;
}

// Internal compatibility symbols expected by solid-js/dist/internal.js
export const trackFillReads = () => {};
export const storeName = "";
export const ssrHandleError = (err: any) => console.error(err);
export const MergeView = class {};
export const OmitView = class {};
export const SOURCE_MEMO = 1;
export const SOURCE_MERGE = 2;
export const SOURCE_OMIT = 3;
export const SOURCE_PLAIN = 4;
export const SOURCE_STORE = 5;
