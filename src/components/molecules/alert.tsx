import type { FailureProperties, NotificationMetadata } from "@johnbot/telemetry";
import type { JSX } from "@solidjs/web";
import { createContext, createEffect, omit, useContext } from "solid-js";
import { cn } from "../utils";

export type AlertTone = "neutral" | "success" | "warning" | "danger";

export interface AlertProps extends JSX.HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone;
  report?: NotificationMetadata | false;
}

const NotificationContext = createContext<((report: FailureProperties) => void) | null>(null);

/** Applications observe presentations. The shared UI does not send or store reports. */
export function NotificationObserver(props: {
  onShown: (report: FailureProperties) => void;
  children?: JSX.Element;
}): JSX.Element {
  return <NotificationContext.Provider value={props.onShown}>{props.children}</NotificationContext.Provider>;
}

export function Alert(props: AlertProps): JSX.Element {
  const observe = useContext(NotificationContext);
  const tone = () => props.tone ?? "neutral";

  createEffect(
    () => props.tone,
    (t) => {
      if (props.report === false || (t !== "danger" && t !== "warning")) return;
      observe?.({
        ...(props.report ?? { operation: "other", source: "system", cause_code: "unknown" }),
        severity: t === "danger" ? "error" : "warning",
        presentation: "banner",
      });
    },
  );
  const others = omit(props, "className", "tone", "report");
  return (
    <div
      className={cn(
        "ui-alert",
        props.className,
      )}
      data-tone={tone()}
      {...others}
    />
  );
}

export function AlertIcon(props: JSX.HTMLAttributes<HTMLSpanElement>): JSX.Element {
  const others = omit(props, "className");
  return (
    <span
      className={cn("ui-alert-icon", props.className)}
      aria-hidden="true"
      {...others}
    />
  );
}

export function AlertContent(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const others = omit(props, "className");
  return <div className={cn("ui-alert-content", props.className)} {...others} />;
}

export function AlertTitle(props: JSX.HTMLAttributes<HTMLElement>): JSX.Element {
  const others = omit(props, "className");
  return <strong className={cn("ui-alert-title", props.className)} {...others} />;
}

export function AlertDescription(props: JSX.HTMLAttributes<HTMLSpanElement>): JSX.Element {
  const others = omit(props, "className");
  return <span className={cn("ui-alert-description", props.className)} {...others} />;
}

export function AlertActions(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const others = omit(props, "className");
  return <div className={cn("ui-alert-actions", props.className)} {...others} />;
}
