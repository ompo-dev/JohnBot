import { useText } from "@johnbot/ui/text";
import { createEffect, onSettled } from "solid-js";
import { cn } from "../../lib/cn";
import { LoadingFace } from "../../components/loading-face";

// The fade takes the overlay duration. If no `animationend` comes, the splash ends this time after the
// app is ready, so it cannot cover the app.
const EXIT_LIMIT_MS = 1500;
const EXIT_ANIMATION = "startup-splash-exit";

export interface StartupSplashProps {
  /** The app is ready: the splash fades out. Remove it in `onExited`. */
  ready: boolean;
  onExited?: () => void;
}

/**
 * The app's first screen: the same clay face an agent or a user has, looking from one side to the
 * other while the app loads. The fade starts when the app is ready.
 */
export function StartupSplash(props: StartupSplashProps) {
  const { t } = useText();
  let root: HTMLElement | undefined;
  let exitTimer: ReturnType<typeof setTimeout> | undefined;
  let exited = false;

  function finishExit(): void {
    if (exited) return;
    exited = true;
    clearTimeout(exitTimer);
    props.onExited?.();
  }

  createEffect(
    () => props.ready,
    (ready) => {
      if (!ready) return;
      exitTimer ??= setTimeout(finishExit, EXIT_LIMIT_MS);
      // Without the stylesheet, or in a test DOM, the exit does not animate: end the splash now.
      if (root && !getComputedStyle(root).animationName.includes(EXIT_ANIMATION)) queueMicrotask(finishExit);
      return () => clearTimeout(exitTimer);
    },
  );

  onSettled(() => () => clearTimeout(exitTimer));

  function handleAnimationEnd(event: AnimationEvent): void {
    if (event.animationName === EXIT_ANIMATION && event.target === event.currentTarget) finishExit();
  }

  return (
    <main
      ref={(element) => {
        root = element;
      }}
      className={cn(
        "startup-splash absolute z-[var(--johnbot-layer-dialog)] inset-0 grid place-items-center bg-[var(--johnbot-bg-canvas)] [app-region:drag]",
        props.ready && "pointer-events-none [app-region:no-drag] animate-[startup-splash-exit_var(--johnbot-duration-overlay)_var(--johnbot-ease-in-out)_forwards]",
      )}
      data-phase={props.ready ? "exit" : "loading"}
      role="status"
      aria-label={t("app.loading")}
      aria-busy={props.ready ? "false" : "true"}
      onAnimationEnd={handleAnimationEnd}
    >
      <LoadingFace size={96} className="startup-splash-logo" />
    </main>
  );
}
