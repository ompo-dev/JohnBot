import type { JSX } from "@solidjs/web";
import { omit } from "solid-js";
import { cn } from "../utils";

export interface ItemGroupProps extends JSX.HTMLAttributes<HTMLDivElement> {
  surface?: "default" | "subtle";
}

export function ItemGroup(props: ItemGroupProps): JSX.Element {
  const others = omit(props, "className", "surface");
  return <div className={cn("ui-item-group", props.className)} data-surface={props.surface ?? "default"} {...others} />;
}

export interface ItemProps extends JSX.HTMLAttributes<HTMLDivElement> {
  size?: "compact" | "default" | "spacious";
}

export function Item(props: ItemProps): JSX.Element {
  const others = omit(props, "className", "size");
  return <div className={cn("ui-item", props.className)} data-size={props.size ?? "default"} {...others} />;
}

export function ItemMedia(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const others = omit(props, "className");
  return <div className={cn("ui-item-media", props.className)} {...others} />;
}

export function ItemContent(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const others = omit(props, "className");
  return <div className={cn("ui-item-content", props.className)} {...others} />;
}

export function ItemTitle(props: JSX.HTMLAttributes<HTMLElement>): JSX.Element {
  const others = omit(props, "className");
  return <strong className={cn("ui-item-title", props.className)} {...others} />;
}

export function ItemDescription(props: JSX.HTMLAttributes<HTMLSpanElement>): JSX.Element {
  const others = omit(props, "className");
  return <span className={cn("ui-item-description", props.className)} {...others} />;
}

export function ItemActions(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const others = omit(props, "className");
  return <div className={cn("ui-item-actions", props.className)} {...others} />;
}
