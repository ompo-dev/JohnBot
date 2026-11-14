import type { JSX } from "@solidjs/web";
import { omit } from "solid-js";
import { cn } from "../utils";

export type RadialProgressTone = "accent" | "warning" | "danger";

export interface RadialProgressProps extends JSX.HTMLAttributes<HTMLDivElement> {
  children?: JSX.Element;
  value: number;
  tone?: RadialProgressTone;
}

const RADIAL_PROGRESS_RADIUS = 20;
const RADIAL_PROGRESS_STROKE_WIDTH = 3.75;
const RADIAL_PROGRESS_CIRCUMFERENCE = 2 * Math.PI * RADIAL_PROGRESS_RADIUS;

export function RadialProgress(props: RadialProgressProps): JSX.Element {
  const others = omit(props, "value", "tone", "className", "children");
  const value = () => Math.min(100, Math.max(0, Number.isFinite(props.value) ? props.value : 0));
  const visibleDashLength = () => (value() / 100) * RADIAL_PROGRESS_CIRCUMFERENCE;
  const hasRoundedEnds = () => visibleDashLength() >= RADIAL_PROGRESS_STROKE_WIDTH;
  const dashLength = () =>
    hasRoundedEnds() ? visibleDashLength() - RADIAL_PROGRESS_STROKE_WIDTH : visibleDashLength();
  const dashArray = () => `${dashLength()} ${RADIAL_PROGRESS_CIRCUMFERENCE - dashLength()}`;

  return (
    <div
      {...others}
      className={cn("ui-radial-progress", props.className)}
      data-tone={props.tone ?? "accent"}
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={value()}
    >
      <svg className="ui-radial-progress-chart" viewBox="0 0 48 48" aria-hidden="true">
        <circle
          className="ui-radial-progress-track"
          cx="24"
          cy="24"
          r={RADIAL_PROGRESS_RADIUS}
          strokeWidth={RADIAL_PROGRESS_STROKE_WIDTH}
        />
        <circle
          className="ui-radial-progress-indicator"
          cx="24"
          cy="24"
          r={RADIAL_PROGRESS_RADIUS}
          data-linecap={hasRoundedEnds() ? "round" : "butt"}
          strokeDasharray={dashArray()}
          strokeDashoffset={hasRoundedEnds() ? -RADIAL_PROGRESS_STROKE_WIDTH / 2 : 0}
          strokeWidth={RADIAL_PROGRESS_STROKE_WIDTH}
          transform="matrix(0 -1 -1 0 48 48)"
        />
      </svg>
      <span className="ui-radial-progress-content">{props.children}</span>
    </div>
  );
}
