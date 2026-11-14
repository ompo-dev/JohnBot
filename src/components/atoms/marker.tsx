import { Dynamic, type JSX } from "@solidjs/web";
import { omit } from "solid-js";
import { cn } from "../utils";

type MarkerElement = "div" | "li" | "section";

export interface MarkerProps extends JSX.HTMLAttributes<HTMLElement> {
  as?: MarkerElement;
}

export function Marker(props: MarkerProps): JSX.Element {
  const others = omit(props, "as", "className");
  return <Dynamic component={props.as ?? "div"} data-slot="marker" className={cn("ui-marker", props.className)} {...others} />;
}

export interface MarkerIconProps extends JSX.HTMLAttributes<HTMLSpanElement> {}

export function MarkerIcon(props: MarkerIconProps): JSX.Element {
  const others = omit(props, "className");
  return <span data-slot="marker-icon" className={cn("ui-marker-icon", props.className)} {...others} />;
}

export interface MarkerContentProps extends JSX.HTMLAttributes<HTMLSpanElement> {}

export function MarkerContent(props: MarkerContentProps): JSX.Element {
  const others = omit(props, "className");
  return <span data-slot="marker-content" className={cn("ui-marker-content", props.className)} {...others} />;
}
