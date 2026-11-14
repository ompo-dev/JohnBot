"use client";

import React, { createContext, useContext } from "react";
import * as Menu from "@radix-ui/react-context-menu";
import { useCompatibleRef } from "./react-ref-compat";
import { usePopupState } from "./kobalte-popup-state";
const Expanded = createContext(false);

export function Root(props: any) {
  const state = usePopupState(props);
  return <Expanded value={state.open}><Menu.Root {...props} onOpenChange={state.onOpenChange} /></Expanded>;
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
export function Content({ ref, onOpenAutoFocus, ...props }: any) {
  const domRef = useCompatibleRef(ref);
  const open = useContext(Expanded);
  return <Menu.Content {...props} data-expanded={open ? "" : undefined} ref={domRef} />;
}
export const Item = Menu.Item;
export function CheckboxItem({ onChange, ...props }: any) {
  return <Menu.CheckboxItem {...props} onCheckedChange={onChange ?? props.onCheckedChange} />;
}
export const RadioGroup = Menu.RadioGroup;
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
export const Group = Menu.Group;
export const Label = Menu.Label;
