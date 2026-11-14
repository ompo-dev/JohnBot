"use client";

import React, { createContext, useContext, useId, useState } from "react";
import { useCompatibleRef } from "./react-ref-compat";

const Group = createContext<any>(null);
const Option = createContext<any>(null);

export function Root({ as: Tag = "div", ref, value, defaultValue, onChange, name, disabled, readOnly, required, orientation, children, ...props }: any) {
  const generated = useId();
  const [selected, setSelected] = useState(defaultValue);
  const current = value ?? selected;
  const domRef = useCompatibleRef(ref);
  const select = (next: string) => {
    if (disabled || readOnly || next === current) return;
    if (value === undefined) setSelected(next);
    onChange?.(next);
  };
  return <Group value={{ current, name: name ?? generated, disabled, readOnly, required, select }}>
    <Tag {...props} ref={domRef} role="radiogroup" aria-orientation={orientation} aria-disabled={disabled || undefined}>{children}</Tag>
  </Group>;
}

export function Item({ as: Tag = "label", ref, value, disabled, children, ...props }: any) {
  const group = useContext(Group);
  const id = useId();
  const domRef = useCompatibleRef(ref);
  const item = { id, value, checked: group.current === value, disabled: disabled || group.disabled };
  return <Option value={item}><Tag {...props} ref={domRef} data-checked={item.checked ? "" : undefined}
    data-disabled={item.disabled ? "" : undefined}>{children}</Tag></Option>;
}

export function ItemInput({ ref, onChange, ...props }: any) {
  const group = useContext(Group);
  const item = useContext(Option);
  const domRef = useCompatibleRef(ref);
  return <input className="sr-only" {...props} ref={domRef} id={item.id} type="radio" name={group.name}
    value={item.value} checked={item.checked} disabled={item.disabled} readOnly={group.readOnly} required={group.required}
    onChange={(event) => { onChange?.(event); if (event.target.checked) group.select(item.value); }} />;
}

export function ItemControl({ as: Tag = "span", ref, ...props }: any) {
  const item = useContext(Option);
  const domRef = useCompatibleRef(ref);
  return <Tag {...props} ref={domRef} data-checked={item.checked ? "" : undefined} data-disabled={item.disabled ? "" : undefined} />;
}
export const ItemIndicator = ItemControl;
export const ItemLabel = (props: any) => <span {...props} />;
export const ItemDescription = (props: any) => <span {...props} />;
export const Label = (props: any) => <span {...props} />;
export const Description = (props: any) => <p {...props} />;
export const ErrorMessage = (props: any) => <p role="alert" {...props} />;
