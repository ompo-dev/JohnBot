import { For } from "solid-js";
const ballLilac = "/upstream/plush/ball-lilac.webp";
const ballMint = "/upstream/plush/ball-mint.webp";
const ballPink = "/upstream/plush/ball-pink.webp";
const bodyLilac = "/upstream/plush/body-lilac.webp";
const eyeLeft = "/upstream/plush/eye-left.webp";
const eyeRight = "/upstream/plush/eye-right.webp";
import { cx } from "./utils";

/** A face that the lilac plush can make. `idle` breathes, blinks and looks around. */
export type PlushMascotFace = "idle" | "wide" | "wink" | "happy";

const BALLS = [ballLilac, ballMint, ballPink];

/**
 * The lilac OpenBot plush. Each layer moves on its own: the body breathes, the eye pair looks
 * around, and each eye blinks. The eye layers cover the whole body, so they line up without offsets.
 * The parent sets the width with `--ui-plush-size`.
 */
export function PlushMascot(props: { face?: PlushMascotFace; className?: string }) {
  return (
    <span className={cx("ui-plush-mascot", props.className)} data-face={props.face ?? "idle"} aria-hidden="true">
      <span className="ui-plush-body">
        <img className="ui-plush-body-image" src={bodyLilac} alt="" draggable={false} />
        <span className="ui-plush-eyes">
          <img className="ui-plush-eye" data-side="left" src={eyeLeft} alt="" draggable={false} />
          <img className="ui-plush-eye" data-side="right" src={eyeRight} alt="" draggable={false} />
        </span>
      </span>
    </span>
  );
}

export interface PlushLoaderProps {
  /** The width of the plush in pixels. The balls scale with it. The default is 32. */
  size?: number;
  /** `row` puts the balls beside the plush, in a line of text. `stack` puts them under it. */
  layout?: "row" | "stack";
  /** What the loader waits for, for a screen reader. Without it, the loader is decoration. */
  label?: string;
  className?: string;
}

/**
 * The lilac plush watches three felt balls bounce in a wave, and its eyes follow the ball in the
 * air. Use it for a wait that a user sees for more than a moment: a panel that loads, or a step in
 * another app. Buttons and small inline waits keep `Spinner`.
 */
export function PlushLoader(props: PlushLoaderProps) {
  return (
    <span
      className={cx("ui-plush-loader", props.className)}
      data-layout={props.layout ?? "row"}
      style={{ "--ui-plush-size": `${props.size ?? 32}px` }}
      role="status"
      aria-label={props.label}
      aria-hidden={props.label ? undefined : "true"}
    >
      <PlushMascot />
      <span className="ui-plush-balls" aria-hidden="true">
        <For each={BALLS}>{(src) => <img className="ui-plush-ball" src={src} alt="" draggable={false} />}</For>
      </span>
    </span>
  );
}
