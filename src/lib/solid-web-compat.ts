"use client";

import React, { type ComponentType, type ReactNode } from "react";
import ReactDOM from "react-dom";

export const isServer = false;

export type ComponentProps<T extends keyof React.JSX.IntrinsicElements | React.JSXElementConstructor<any>> =
  React.ComponentProps<T>;

export type ValidComponent = any;
export type JSX = any;
export type ParentProps<P = {}> = P & { children?: ReactNode };

export function Dynamic({ component: Component, ...props }: { component: ComponentType<any> | string; [key: string]: any }): ReactNode {
  if (!Component) return null;
  return React.createElement(Component, props);
}

export function Portal({ children, mount }: { children: ReactNode; mount?: Element }): ReactNode {
  if (typeof document === "undefined") return null;
  return ReactDOM.createPortal(children, mount || document.body);
}

export function render(code: () => ReactNode, mount: Element) {
  if (typeof window !== "undefined") {
    const root = (ReactDOM as any).createRoot(mount);
    root.render(code());
  }
}

// Runtime helpers for Solid compiled packages (e.g. bloub)
export const template = (html: string) => () => null;
export const spread = () => {};
export const insert = () => {};
export const effect = () => {};
export const memo = (fn: any) => fn;
export const createComponent = (Comp: any, props: any) => React.createElement(Comp, props);
export const delegateEvents = () => {};
export const setAttribute = () => {};
export const classList = () => {};
export const style = () => {};
export const use = (fn: any) => fn;
export const ref = () => {};
export const className = () => {};
// biome-ignore lint/suspicious/noShadowRestrictedNames: Solid's SSR API exports this public name.
export const escape = (v: any) => v;
export const ssr = (v: any) => v;
export const ssrAttribute = () => "";
export const ssrClassName = () => "";
export const ssrGroup = (v: any) => v;
export const ssrHydrationKey = () => "";
export const ssrStyle = () => "";
export function mergeProps<T extends object>(...sources: any[]): T {
  const target: any = {};
  for (const src of sources) {
    if (typeof src === "function") {
      Object.assign(target, src());
    } else if (src && typeof src === "object") {
      Object.assign(target, src);
    }
  }
  return target;
}
