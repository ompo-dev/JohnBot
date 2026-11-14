"use client";

import React, { createContext, useContext, useRef, useState } from "react";
import { useCompatibleRef } from "./react-ref-compat";

const Context = createContext<any>(null);
export function Root({ as: Tag = "div", ref, checked, defaultChecked, onChange, disabled, readOnly, name, value, required, children, ...props }: any) {
  const [uncontrolled, setUncontrolled] = useState(defaultChecked ?? false);
  const input = useRef<HTMLInputElement>(null);
  const current = checked ?? uncontrolled;
  const domRef = useCompatibleRef(ref);
  const setIsChecked = (next: boolean) => {
    if (disabled || readOnly || next === current) return;
    if (checked === undefined) setUncontrolled(next);
    onChange?.(next);
  };
  return <Context value={{ checked: () => current, setIsChecked, input, inputRef: () => input.current, disabled, readOnly, name, value, required }}>
    <Tag {...props} ref={domRef} data-checked={current ? "" : undefined} data-disabled={disabled ? "" : undefined}>{children}</Tag>
  </Context>;
}
export function Input({ ref, onChange, ...props }: any) {
  const context = useContext(Context);
  const domRef = useCompatibleRef([ref, context.input]);
  return <input {...props} ref={domRef} type="checkbox" role="switch" name={context.name} value={context.value}
    checked={context.checked()} disabled={context.disabled} readOnly={context.readOnly} required={context.required}
    onChange={(event) => { onChange?.(event); context.setIsChecked(event.target.checked); }} />;
}
export function Control({ as: Tag = "div", ref, onClick, ...props }: any) {
  const context = useContext(Context);
  const domRef = useCompatibleRef(ref);
  return <Tag {...props} ref={domRef} data-checked={context.checked() ? "" : undefined} data-disabled={context.disabled ? "" : undefined}
    onClick={(event: React.MouseEvent) => {
      if (!event.defaultPrevented) context.setIsChecked(!context.checked());
      onClick?.(event);
    }} />;
}
export function Thumb({ as: Tag = "span", ref, ...props }: any) {
  const context = useContext(Context);
  const domRef = useCompatibleRef(ref);
  return <Tag {...props} ref={domRef} data-checked={context.checked() ? "" : undefined} />;
}
export const Label = (props: any) => <label {...props} />;
export const Description = (props: any) => <p {...props} />;
export function useSwitchContext() { return useContext(Context); }
