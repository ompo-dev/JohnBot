"use client";

import React, { createContext, useContext, useState } from "react";
import * as Select from "@radix-ui/react-select";
import { useCompatibleRef } from "./react-ref-compat";
import { usePopupState } from "./kobalte-popup-state";

const Selection = createContext<any>(null);
const field = (option: any, key: any) =>
  typeof key === "function" ? key(option) : key ? option?.[key] : option;

export function Root(props: any) {
  const state = usePopupState(props);
  const [uncontrolled, setUncontrolled] = useState(props.defaultValue);
  const selected = props.value !== undefined ? props.value : uncontrolled;
  const options = (props.options ?? []).flatMap((option: any) =>
    props.optionGroupChildren ? option[props.optionGroupChildren] ?? [option] : [option]);
  const key = (option: any) => String(field(option, props.optionValue));
  const label = (option: any) => String(field(option, props.optionTextValue) ?? "");
  const context = {
    open: state.open,
    selectedOption: () => selected,
    selectedOptions: () => selected == null ? [] : [selected],
    options, key, label,
    itemComponent: props.itemComponent,
    disabled: (option: any) => Boolean(field(option, props.optionDisabled ?? (() => false))),
  };
  return (
    <Selection value={context}>
      <Select.Root value={selected == null ? "" : key(selected)} defaultOpen={props.defaultOpen}
        open={state.open} onOpenChange={state.onOpenChange} disabled={props.disabled}
        name={props.name} required={props.required} onValueChange={(value) => {
          const option = options.find((entry: any) => key(entry) === value);
          setUncontrolled(option);
          props.onChange?.(option);
        }}>
        <div className={props.className ?? props.class} style={props.style}>{props.children}</div>
      </Select.Root>
    </Selection>
  );
}
export function Trigger({ as, ref, ...props }: any) {
  const domRef = useCompatibleRef(ref);
  const context = useContext(Selection);
  return <Select.Trigger {...props} data-expanded={context?.open ? "" : undefined} ref={domRef} asChild={Boolean(as)}>
    {as ? React.createElement(as, null, props.children) : props.children}
  </Select.Trigger>;
}
export function Value({ children, ...props }: any) {
  const context = useContext(Selection);
  return <span {...props}>{typeof children === "function"
    ? children(context)
    : children ?? (context?.selectedOption() == null ? props.placeholder : context.label(context.selectedOption()))}</span>;
}
export function Portal({ mount, children }: any) {
  return <Select.Portal container={mount}>{children}</Select.Portal>;
}
export function Content({ ref, sameWidth, placement, ...props }: any) {
  const domRef = useCompatibleRef(ref);
  const context = useContext(Selection);
  return <Select.Content {...props} data-expanded={context?.open ? "" : undefined} ref={domRef} position="popper" sideOffset={4} />;
}
export function Listbox({ scrollRef, children, ...props }: any) {
  const context = useContext(Selection);
  return <Select.Viewport {...props}>{children ?? context?.options.map((option: any) => {
    const item = { key: context.key(option), rawValue: option, textValue: context.label(option), disabled: context.disabled(option) };
    return <React.Fragment key={item.key}>{context.itemComponent
      ? context.itemComponent({ item })
      : <Select.Item value={item.key} disabled={item.disabled}><Select.ItemText>{item.textValue}</Select.ItemText></Select.Item>}
    </React.Fragment>;
  })}</Select.Viewport>;
}
export function Item({ item, value, ...props }: any) {
  return <Select.Item {...props} value={item?.key ?? value} disabled={props.disabled ?? item?.disabled} />;
}
export const Icon = Select.Icon;
export const ItemLabel = Select.ItemText;
export const ItemIndicator = Select.ItemIndicator;
export const Section = Select.Group;
export const Label = Select.Label;
export const Description = (props: any) => <p {...props} />;
export const ErrorMessage = (props: any) => <p role="alert" {...props} />;
export const HiddenSelect = () => null;
