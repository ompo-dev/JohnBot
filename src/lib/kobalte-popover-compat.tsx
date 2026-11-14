"use client";

import React, { createContext, useContext, type CSSProperties } from "react";
import * as Primitive from "@radix-ui/react-popover";
import { useCompatibleRef } from "./react-ref-compat";
import { usePopupState } from "./kobalte-popup-state";

const Position = createContext({ placement: "bottom", gutter: 8, sameWidth: false, open: false });

export function Root({ placement = "bottom", gutter = 8, sameWidth = false, children, ...props }: any) {
  const state = usePopupState(props);
  return <Position value={{ placement, gutter, sameWidth, open: state.open }}>
    <Primitive.Root {...props} {...state}>{children}</Primitive.Root>
  </Position>;
}
export function Trigger({ ref, as, ...props }: any) {
  const domRef = useCompatibleRef(ref);
  return <Primitive.Trigger {...(as ? {} : props)} ref={domRef} asChild={Boolean(as)}>
    {as ? React.createElement(as, props) : props.children}
  </Primitive.Trigger>;
}
export function Portal({ mount, ...props }: any) {
  return <Primitive.Portal {...props} container={mount} />;
}
export function Content({ ref, style, ...props }: any) {
  const domRef = useCompatibleRef(ref);
  const position = useContext(Position);
  const [side, align = "center"] = position.placement.split("-");
  return <Primitive.Content {...props} ref={domRef} side={side as any} align={align as any}
    sideOffset={position.gutter} collisionPadding={12} data-expanded={position.open ? "" : undefined}
    onFocusOutside={(event) => event.preventDefault()}
    data-kb-top-layer="" style={{
      "--kb-popover-content-transform-origin": "var(--radix-popover-content-transform-origin)",
      "--kb-popper-content-available-height": "var(--radix-popover-content-available-height)",
      "--kb-popper-anchor-width": "var(--radix-popover-trigger-width)",
      maxHeight: "var(--radix-popover-content-available-height)", overflowY: "auto", zIndex: 1000,
      ...(position.sameWidth ? { width: "var(--radix-popover-trigger-width)" } : {}), ...style,
    } as CSSProperties} />;
}
export const Title = ({ children, ...props }: any) => <h2 {...props}>{children}</h2>;
export const Description = ({ children, ...props }: any) => <p {...props}>{children}</p>;
export function CloseButton({ ref, ...props }: any) {
  return <Primitive.Close {...props} ref={useCompatibleRef(ref)} />;
}
export const Anchor = Primitive.Anchor;
export const Arrow = Primitive.Arrow;
