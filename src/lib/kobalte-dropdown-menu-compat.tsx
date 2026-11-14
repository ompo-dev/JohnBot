"use client";

import React, { createContext, useContext } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useCompatibleRef } from "./react-ref-compat";
import { usePopupState } from "./kobalte-popup-state";
const Placement = createContext({ placement: "bottom-start", gutter: 4 });
const Expanded = createContext(false);

export function Root({ placement, gutter, getAnchorRect, ...props }: any) {
  const state = usePopupState(props);
  return <Placement value={{ placement: placement ?? "bottom-start", gutter: gutter ?? 4 }}>
    <Expanded value={state.open}><Menu.Root {...props} {...state} /></Expanded>
  </Placement>;
}
export function Trigger({ as, ref, ...props }: any) {
  const domRef = useCompatibleRef(ref);
  return <Menu.Trigger {...(as ? {} : props)} ref={domRef} asChild={Boolean(as)}>
    {as ? React.createElement(as, props) : props.children}
  </Menu.Trigger>;
}
export function Portal({ mount, ...props }: any) {
  return <Menu.Portal {...props} container={mount} />;
}
export function Content({ ref, placement, gutter, onOpenAutoFocus, ...props }: any) {
  const domRef = useCompatibleRef(ref);
  const open = useContext(Expanded);
  const inherited = useContext(Placement);
  const [side = "bottom", align = "start"] = (placement ?? inherited.placement).split("-");
  return <Menu.Content {...props} data-expanded={open ? "" : undefined} ref={domRef} side={side} align={align} sideOffset={gutter ?? inherited.gutter} />;
}
export function Item({ closeOnSelect, onSelect, ...props }: any) {
  return <Menu.Item {...props} onSelect={(event) => {
    onSelect?.(event);
    if (closeOnSelect === false) event.preventDefault();
  }} />;
}
export function CheckboxItem({ onChange, closeOnSelect, onSelect, ...props }: any) {
  return <Menu.CheckboxItem {...props} onCheckedChange={onChange ?? props.onCheckedChange}
    onSelect={(event) => {
      onSelect?.(event);
      if (closeOnSelect === false) event.preventDefault();
    }} />;
}
export function RadioGroup({ onChange, ...props }: any) {
  return <Menu.RadioGroup {...props} onValueChange={onChange ?? props.onValueChange} />;
}
export const RadioItem = Menu.RadioItem;
export const Separator = Menu.Separator;
export function Sub(props: any) {
  const state = usePopupState(props);
  return <Expanded value={state.open}><Menu.Sub {...props} {...state} /></Expanded>;
}
export function SubTrigger({ ref, ...props }: any) {
  const domRef = useCompatibleRef(ref);
  return <Menu.SubTrigger {...props} ref={domRef} />;
}
export function SubContent({ ref, ...props }: any) {
  const domRef = useCompatibleRef(ref);
  const open = useContext(Expanded);
  return <Menu.SubContent {...props} data-expanded={open ? "" : undefined} ref={domRef} />;
}
export const ItemIndicator = Menu.ItemIndicator;
export const ItemLabel = Menu.Label;
export const Group = Menu.Group;
export const Arrow = Menu.Arrow;
