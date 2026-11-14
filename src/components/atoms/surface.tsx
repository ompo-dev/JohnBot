import type { JSX } from "@solidjs/web";
import { omit } from "solid-js";
import { cn } from "../utils";

export function Card(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const local = props;
  const others = omit(props, "className");
  return <div className={cn("ui-card", local.className)} {...others} />;
}

export interface SeparatorProps extends JSX.HTMLAttributes<HTMLHRElement> {
  orientation?: "horizontal" | "vertical";
}

export function Separator(props: SeparatorProps): JSX.Element {
  const local = props;
  const others = omit(props, "className", "orientation");
  const orientation = local.orientation ?? "horizontal";
  return (
    <hr
      className={cn("ui-separator", local.className)}
      data-orientation={orientation}
      aria-orientation={orientation}
      {...others}
    />
  );
}

export interface SpinnerProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  size?: "sm" | "md" | "lg";
  label?: string;
}

export function Spinner(props: SpinnerProps): JSX.Element {
  const local = props;
  const others = omit(props, "className", "size", "label");
  return (
    <span
      className={cn("ui-spinner", local.className)}
      data-size={local.size ?? "md"}
      role="status"
      aria-label={local.label}
      aria-hidden={local.label ? undefined : "true"}
      {...others}
    />
  );
}

export function Skeleton(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const local = props;
  const others = omit(props, "className");
  return <div className={cn("ui-skeleton", local.className)} aria-hidden="true" {...others} />;
}

export function Kbd(props: JSX.HTMLAttributes<HTMLElement>): JSX.Element {
  const local = props;
  const others = omit(props, "className");
  return <kbd className={cn("ui-kbd", local.className)} {...others} />;
}
