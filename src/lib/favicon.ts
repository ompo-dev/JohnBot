"use client";
import { BotEngine, COLOR_BY_ID, EXPRESSION_BY_ID, RAYON, SHAPE_BY_ID } from "@norbert_bodziony/bloub";
import { bloubAvatarProfile } from "@johnbot/brand/bloub-avatar";
import type { AvatarHue } from "@johnbot/contracts/ipc";
import { loadingAvatar, sideGlance } from "./loading-avatar";

/** One drawing of the favicon, and how long it stays on screen. */
export interface FaviconFrame {
  href: string;
  ms: number;
}

// 10 frames a second draws a blink in two frames; the 6 s loop holds a few blinks and two glances.
const FRAMES_PER_SECOND = 10;
const LOOP_SECONDS = 6;
// The engine draws the body of the face and the eyes; the eyes use the same paper colour as Bloub.
const EYE_COLOR = "#f9f9f9";

/**
 * The frames of the animated favicon, with the time each one lasts. Consecutive frames that draw the
 * same picture are merged, so a held gaze costs one icon change instead of dozens.
 */
export function buildFaviconTimeline(seed: string, hue: AvatarHue): FaviconFrame[] {
  const profile = bloubAvatarProfile(seed, hue);
  const color = COLOR_BY_ID.get(profile.color)?.hex ?? "#8b5cf6";
  const engine = new BotEngine(RAYON, "idle", SHAPE_BY_ID.get(profile.shape)?.radii, EXPRESSION_BY_ID.get("surpris"));
  const step = 1000 / FRAMES_PER_SECOND;
  const timeline: FaviconFrame[] = [];
  let signature = "";
  for (let index = 0; index < LOOP_SECONDS * FRAMES_PER_SECOND; index += 1) {
    // Half a step in, so the first frame never samples the engine at zero (its look is undefined there).
    const seconds = (index + 0.5) / FRAMES_PER_SECOND;
    const look = sideGlance(seconds);
    engine.setLook(look, 0, 0);
    const frame = engine.sample(seconds);
    const eyes = frame.eyes
      .map((eye) => `<path d="${eye.d}" transform="${eye.matrix}" opacity="${eye.alpha}" fill="${EYE_COLOR}"/>`)
      .join("");
    // The eyes drift less than a pixel per frame, and the tab icon cannot show that. A frame is a new
    // drawing only when the glance turns or an eyelid moves, so a held gaze costs one icon change.
    const lid = /matrix\([^,]+,[^,]+,[^,]+,([^,]+)/u.exec(frame.eyes[0]?.matrix ?? "")?.[1] ?? "1";
    const next = `${Math.round(look.yaw)}:${Math.round(look.pitch)}:${Number.parseFloat(lid).toFixed(2)}`;
    const last = timeline[timeline.length - 1];
    if (last && next === signature) {
      last.ms += step;
      continue;
    }
    signature = next;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-158 -158 316 316">` +
      `<path d="${frame.bodyPath}" fill="${color}"/>${eyes}</svg>`;
    // A data URL keeps the icon in the document: no request, no file, and the tab updates at once.
    timeline.push({ href: `data:image/svg+xml,${encodeURIComponent(svg)}`, ms: step });
  }
  return timeline;
}

/**
 * Swaps the favicon through the frames of the face this page load picked. Only the timing runs in
 * the background: the browser repaints the tab icon when a drawing changes, and the loop pauses
 * while the tab is hidden. Returns the cleanup for the screen that installed it.
 */
export function installAnimatedFavicon(): () => void {
  if (typeof document === "undefined") return () => undefined;
  const face = loadingAvatar();
  const timeline = buildFaviconTimeline(face.seed, face.hue);
  if (timeline.length === 0) return () => undefined;

  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/svg+xml";
  link.setAttribute("sizes", "any");
  link.dataset.animated = "true";
  document.head.append(link);

  let index = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let paused = false;

  function advance(): void {
    const frame = timeline[index];
    index = (index + 1) % timeline.length;
    if (frame) {
      link.href = frame.href;
      timer = setTimeout(advance, frame.ms);
    }
  }

  function onVisibilityChange(): void {
    if (document.hidden) {
      paused = true;
      clearTimeout(timer);
      timer = undefined;
    } else if (paused) {
      paused = false;
      advance();
    }
  }

  document.addEventListener("visibilitychange", onVisibilityChange);
  advance();

  return () => {
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    link.remove();
  };
}
