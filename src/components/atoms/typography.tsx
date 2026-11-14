import { Dynamic, type JSX } from "@solidjs/web";
import { omit } from "solid-js";
import { cn } from "../utils";

export type TextVariant = "caption" | "label-sm" | "label" | "body-sm" | "body";
export type HeadingSize = "sm" | "md" | "lg";
export type TextTone = "primary" | "secondary" | "muted" | "danger" | "success" | "warning";

type TextElement = "span" | "p" | "div" | "small" | "strong" | "label";
type HeadingElement = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export interface TextProps extends JSX.HTMLAttributes<HTMLElement> {
  as?: TextElement;
  variant?: TextVariant;
  tone?: TextTone;
  truncate?: boolean;
}

export function Text(props: TextProps): JSX.Element {
  const local = props;
  const others = omit(props, "as", "variant", "tone", "truncate", "className");
  return (
    <Dynamic
      component={local.as ?? "span"}
      className={cn("ui-text", local.truncate && "min-w-0 truncate", local.className)}
      data-variant={local.variant ?? "body-sm"}
      data-tone={local.tone ?? "primary"}
      {...others}
    />
  );
}

export interface HeadingProps extends JSX.HTMLAttributes<HTMLHeadingElement> {
  as?: HeadingElement;
  size?: HeadingSize;
  tone?: TextTone;
  truncate?: boolean;
}

export function Heading(props: HeadingProps): JSX.Element {
  const local = props;
  const others = omit(props, "as", "size", "tone", "truncate", "className");
  return (
    <Dynamic
      component={local.as ?? "h2"}
      className={cn("ui-heading", local.truncate && "min-w-0 truncate", local.className)}
      data-size={local.size ?? "md"}
      data-tone={local.tone ?? "primary"}
      {...others}
    />
  );
}
