import { AVATAR_HUE_CHOICES, avatarCandidateSeeds } from "@johnbot/brand/bloub-avatar";
import type { AvatarHue } from "@johnbot/contracts/ipc";

/** The silhouette and colour that this page load shows, from the agent setup palette. */
export interface LoadingAvatar {
  seed: string;
  hue: AvatarHue;
}

const SEEDS = avatarCandidateSeeds("loading-face", "loading-face", 0);
const HUES = AVATAR_HUE_CHOICES.map((option) => option.hue);
// On `globalThis`, so every screen and the favicon of this page load read one pick, even when a
// module ends up in more than one chunk. Only a reload picks another.
const globals = globalThis as typeof globalThis & { johnbotLoadingFace?: LoadingAvatar };

export function loadingAvatar(): LoadingAvatar {
  globals.johnbotLoadingFace ??= {
    seed: SEEDS[Math.floor(Math.random() * SEEDS.length)] ?? "loading-face",
    hue: HUES[Math.floor(Math.random() * HUES.length)] ?? 185,
  };
  return globals.johnbotLoadingFace;
}

// One full look: hold on a side, sweep to the other side, hold, sweep back.
export const GLANCE_SECONDS = 3.6;
const GLANCE_YAW = 34;

/** The eyes look to one side, then to the other, pausing on each: a slow scan of the screen. */
export function sideGlance(seconds: number) {
  const phase = (seconds % GLANCE_SECONDS) / GLANCE_SECONDS;
  const wave = Math.sin(phase * Math.PI * 2);
  // `min(1, |wave| * 2.4)` holds the eyes on the side and makes the sweep between sides quick.
  const side = Math.sign(wave) * Math.min(1, Math.abs(wave) * 2.4);
  return { yaw: side * GLANCE_YAW, pitch: wave * 3, mix: 1, spin: 0, wander: 0 };
}
