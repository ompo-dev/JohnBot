import type { JSX } from "@solidjs/web";
import { omit } from "solid-js";
import { cn } from "../utils";

function sanitizeStyle(style: any): any {
  if (typeof style !== "string") return style;
  if (!style.trim()) return undefined;
  const result: Record<string, string> = {};
  for (const rule of style.split(";")) {
    const colon = rule.indexOf(":");
    if (colon > -1) {
      const prop = rule.slice(0, colon).trim();
      const val = rule.slice(colon + 1).trim();
      if (prop && val) {
        const reactProp = prop.startsWith("--")
          ? prop
          : prop.replace(/^-ms-/, "ms-").replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
        result[reactProp] = val;
      }
    }
  }
  return result;
}

export interface MessageGroupProps extends JSX.HTMLAttributes<HTMLDivElement> {}

export function MessageGroup(props: MessageGroupProps): JSX.Element {
  const others = omit(props, "className", "style");
  return <div data-slot="message-group" className={cn("ui-message-group", props.className)} style={sanitizeStyle(props.style)} {...others} />;
}

export interface MessageProps extends JSX.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end";
}

export function Message(props: MessageProps): JSX.Element {
  const others = omit(props, "align", "className", "style");
  return (
    <div data-slot="message" data-align={props.align ?? "start"} className={cn("ui-message", props.className)} style={sanitizeStyle(props.style)} {...others} />
  );
}

export interface MessageAvatarProps extends JSX.HTMLAttributes<HTMLDivElement> {}

export function MessageAvatar(props: MessageAvatarProps): JSX.Element {
  const others = omit(props, "className");
  return <div data-slot="message-avatar" className={cn("ui-message-avatar", props.className)} {...others} />;
}

export interface MessageContentProps extends JSX.HTMLAttributes<HTMLDivElement> {}

export function MessageContent(props: MessageContentProps): JSX.Element {
  const others = omit(props, "className");
  return <div data-slot="message-content" className={cn("ui-message-content", props.className)} {...others} />;
}

export interface MessageHeaderProps extends JSX.HTMLAttributes<HTMLDivElement> {}

export function MessageHeader(props: MessageHeaderProps): JSX.Element {
  const others = omit(props, "className");
  return <div data-slot="message-header" className={cn("ui-message-header", props.className)} {...others} />;
}

export interface MessageFooterProps extends JSX.HTMLAttributes<HTMLDivElement> {}

export function MessageFooter(props: MessageFooterProps): JSX.Element {
  const others = omit(props, "className");
  return <div data-slot="message-footer" className={cn("ui-message-footer", props.className)} {...others} />;
}
