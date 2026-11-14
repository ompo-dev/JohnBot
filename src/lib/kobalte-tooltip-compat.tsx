"use client";

import React, { createContext, useContext } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useCompatibleRef } from "./react-ref-compat";
import { usePopupState } from "./kobalte-popup-state";
const Expanded = createContext(false);
const Placement = createContext({ placement: "top", gutter: 8 });

export function Root({ openDelay, closeDelay, skipDelayDuration, disabled, placement, gutter, ...props }: any) {
  const state = usePopupState(props);
  return <Placement value={{ placement: placement ?? "top", gutter: gutter ?? 8 }}>
    <Tooltip.Provider delayDuration={openDelay} skipDelayDuration={skipDelayDuration}>
    <Expanded value={!disabled && state.open}><Tooltip.Root {...props} {...state} open={disabled ? false : state.open} /></Expanded>
    </Tooltip.Provider>
  </Placement>;
}
export function Trigger({ as, ref, onFocusIn, onFocusOut, ...props }: any) {
  const domRef = useCompatibleRef(ref);
  return <Tooltip.Trigger asChild={Boolean(as)} {...(as ? {} : props)}
    ref={domRef}>
    {as ? React.createElement(as, {
      ...props,
      onFocus: onFocusIn ?? props.onFocus,
      onBlur: onFocusOut ?? props.onBlur,
    }) : props.children}
  </Tooltip.Trigger>;
}
export function Portal({ mount, ...props }: any) {
  return <Tooltip.Portal {...props} container={mount} />;
}
export function Content({ ref, placement, gutter, onCurrentPlacementChange, ...props }: any) {
  const domRef = useCompatibleRef(ref);
  const open = useContext(Expanded);
  const inherited = useContext(Placement);
  const [side = "top", align = "center"] = (placement ?? inherited.placement).split("-");
  return <Tooltip.Content {...props} data-expanded={open ? "" : undefined} ref={domRef} side={side} align={align} sideOffset={gutter ?? inherited.gutter} />;
}
export const Arrow = Tooltip.Arrow;
