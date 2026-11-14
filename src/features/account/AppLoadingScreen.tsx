import type { AppTextKey } from "@johnbot/i18n";
import type { JSX } from "@solidjs/web";
import { createEffect, createSignal, For, onSettled, untrack } from "solid-js";
import { ErrorReference } from "../../components/error-reference";
import { LoadingFace } from "../../components/loading-face";
import { useText } from "../../components/text";

/*
 * One clock drives the whole screen: the status line takes turns from it, and the face and the CSS
 * animations start at the same time. `--app-loading-at` moves them back to the clock's time when the
 * screen mounts, so the handoff between the page and the app does not restart the loop.
 */
const CREW_FPS = 30;
// The six status lines take turns every 2.4s.
const LOOP_S = 4.8;
const STATUS_EVERY_S = LOOP_S / 2;
// When the app is ready before this time, the screen only fades. The face does not jump out.
const QUICK_EXIT_S = 0.6;
// The longest exit is 760ms of jumps and the fade. If no `animationend` comes, the screen ends after
// this time, so it cannot cover the app.
const EXIT_LIMIT_MS = 2500;
const EXIT_ANIMATION = "app-loading-exit";

const STATUS_LINES = [
  "webClient.loadingLine.wake",
  "webClient.loadingLine.coffee",
  "webClient.loadingLine.tokens",
  "webClient.loadingLine.prompts",
  "webClient.loadingLine.sleepy",
  "webClient.loadingLine.almost",
] as const satisfies readonly AppTextKey[];

/*
 * The screens on one page share one clock. The `/app` page shows a screen while the web client's code
 * loads, and the web client then shows its own. The second screen continues the clock of the first,
 * so the status line does not start again at the handoff.
 */
const HANDOFF_MS = 1000;
const sharedClock = { start: 0, screens: 0, lastUnmount: Number.NEGATIVE_INFINITY };

/** The clock time in seconds for a screen that mounts now. A new run starts when no screen is shown. */
function clockTime(now: number): number {
  if (sharedClock.screens === 0 && now - sharedClock.lastUnmount > HANDOFF_MS) sharedClock.start = now;
  return (now - sharedClock.start) / 1000;
}

/** Keeps the run going while this screen is shown. Returns the cleanup that ends it. */
function joinClock(): () => void {
  sharedClock.screens += 1;
  return () => {
    sharedClock.screens -= 1;
    sharedClock.lastUnmount = performance.now();
  };
}

function snapToFrame(seconds: number): number {
  return Math.floor(seconds * CREW_FPS) / CREW_FPS;
}

export interface AppLoadingScreenProps {
  /** The app is ready: the face jumps out and the screen fades. Remove the screen in `onExited`. */
  ready?: boolean;
  onExited?: () => void;
  /** Stop the clock and show the frame at this time, in seconds. */
  at?: number;
  /** What the screen waits for, for a screen reader. The default is the app load. */
  label?: string;
  title?: string;
  detail?: string;
  /** The code of the failure in `detail`, for a user to copy into a report. */
  reference?: string | null;
  actions?: JSX.Element;
  /** Content under the actions, such as an offer that the wait makes useful. */
  footer?: JSX.Element;
}

export function AppLoadingScreen(props: AppLoadingScreenProps) {
  const { t } = useText();
  // A screen stays in one mode: it shows one frame or it plays.
  const scrub = untrack(() => props.at !== undefined);
  const mountedAt = scrub ? 0 : snapToFrame(clockTime(performance.now()));
  const [clock, setClock] = createSignal(mountedAt);
  const seconds = () => props.at ?? clock();
  const status = () => STATUS_LINES[Math.floor(seconds() / STATUS_EVERY_S) % STATUS_LINES.length] ?? STATUS_LINES[0];
  // The clock stops when the app is ready, so the exit that it selects cannot change.
  const phase = () => {
    if (!props.ready) return "loading";
    return seconds() < QUICK_EXIT_S ? "fade" : "exit";
  };
  let frameRequest = 0;
  let stopped = false;
  let exitTimer: ReturnType<typeof setTimeout> | undefined;
  let exited = false;
  let root: HTMLElement | undefined;

  function finishExit(): void {
    if (exited) return;
    exited = true;
    clearTimeout(exitTimer);
    props.onExited?.();
  }

  function stopClock(): void {
    stopped = true;
    cancelAnimationFrame(frameRequest);
  }

  createEffect(
    () => props.ready,
    (ready) => {
      if (!ready) return;
      stopClock();
      exitTimer ??= setTimeout(finishExit, EXIT_LIMIT_MS);
      // Without the stylesheet, or in a test DOM, the exit does not animate: end the screen now.
      if (root && !getComputedStyle(root).animationName.includes(EXIT_ANIMATION)) queueMicrotask(finishExit);
    },
  );

  onSettled(() => {
    if (scrub) return () => clearTimeout(exitTimer);
    const leaveClock = joinClock();
    const start = performance.now();
    const tick = (now: number) => {
      frameRequest = requestAnimationFrame(tick);
      // Snap to whole frames, so a given time always draws the same frame.
      setClock(snapToFrame(mountedAt + Math.max(0, now - start) / 1000));
    };
    if (!stopped) frameRequest = requestAnimationFrame(tick);
    return () => {
      stopClock();
      clearTimeout(exitTimer);
      leaveClock();
    };
  });

  function handleAnimationEnd(event: AnimationEvent): void {
    if (event.animationName === EXIT_ANIMATION && event.target === event.currentTarget) finishExit();
  }

  return (
    <main
      ref={(element) => {
        root = element;
      }}
      className="app-loading"
      style={{
        "--app-loading-at": `${props.at ?? mountedAt}s`,
      }}
      data-phase={phase()}
      data-scrub={scrub ? "true" : undefined}
      role="status"
      aria-live="polite"
      aria-busy={props.ready ? "false" : "true"}
      onAnimationEnd={handleAnimationEnd}
    >
      <span className="sr-only">{props.label ?? t("webClient.loading")}</span>
      <div className="app-loading-stage">
        <div className="app-loading-row" aria-hidden="true">
          <div className="app-loading-agent" data-face="true" style={{ "--app-loading-index": 0 }}>
            <div className="app-loading-body">
              <LoadingFace size={112} at={props.at} className="app-loading-bot" />
            </div>
          </div>
        </div>
        <p className="app-loading-status">
          {props.title ?? <For each={[status()]}>{(line) => <span className="app-loading-line">{t(line)}</span>}</For>}
        </p>
        {props.detail && <p className="server-connection-detail">{props.detail}</p>}
        <ErrorReference reference={props.reference} />
        {props.actions && <div className="server-connection-actions">{props.actions}</div>}
        {props.footer}
      </div>
    </main>
  );
}

/** The length of the loading loop in seconds, for a story that shows one frame. */
export const APP_LOADING_LOOP_S = LOOP_S;
/** The frame rate of the loading clock, for a story that shows one frame. */
export const APP_LOADING_FPS = CREW_FPS;
