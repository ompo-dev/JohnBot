"use client";
import { useCallback, useRef } from "react";
import { useStore } from "zustand";
import { applyStoreAction, IS_ACCESSOR, type Accessor, type Setter } from "../lib/solid-react-compat";
import { readWorkspaceValue, updateWorkspaceValue, workspaceKey, workspaceStore } from "../stores/workspace-store";

/** Preserve the accessor API while sharing the value across provider consumers/remounts. */
export function useSharedSignal<T>(workspace: string, field: string, initial?: T): [Accessor<T>, Setter<T>] {
  const key = workspaceKey(workspace, field);
  const seed = useRef(initial);
  useStore(workspaceStore, (state) => Object.hasOwn(state.values, key) ? state.values[key] : readWorkspaceValue(key, seed.current));
  const get = useCallback(() => readWorkspaceValue(key, seed.current) as T, [key]);
  Object.assign(get, { [IS_ACCESSOR]: true });
  const set = useCallback((next: T | ((previous: T) => T)) => updateWorkspaceValue(key, seed.current as T, next), [key]);
  return [get, set];
}
type StoreAction<T> = Partial<T> | ((draft: T) => T | void);
export function useSharedStore<T extends object>(workspace: string, field: string, initial: T): [T, (action: StoreAction<T>) => void] {
  const [read, write] = useSharedSignal(workspace, field, initial);
  const set = useCallback((action: StoreAction<T>) => write((previous) => applyStoreAction(previous, action)), [write]);
  return [read(), set];
}
