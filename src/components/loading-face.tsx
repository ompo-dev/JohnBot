"use client";
import { BloubBot, type Block } from "@norbert_bodziony/bloub";
import { bloubAvatarProfile } from "@johnbot/brand/bloub-avatar";
import type { AvatarHue } from "@johnbot/contracts/ipc";
import { useEffect, useState } from "react";
import { loadingAvatar, type LoadingAvatar, sideGlance } from "../lib/loading-avatar";
import { cx } from "./utils";

/** The idle face: it blinks and follows `sideGlance`. */
const FACE_CYCLE: Block[] = [{ state: "idle", duration: 60 * 60 }];

export interface LoadingFaceProps {
  /** The width of the face in pixels. The default is 112. */
  size?: number;
  /** A fixed seed, as for an agent avatar. Without it, the face takes the pick of this page load. */
  seed?: string;
  /** A fixed hue, as for an agent avatar. Without it, the face takes the colour of this page load. */
  hue?: AvatarHue;
  /** Show the face at this second instead of playing it. Used by a story or a test. */
  at?: number;
  className?: string;
}

/**
 * The face that watches the app load: the same avatar an agent or a user has, drawn by Bloub. One
 * page load keeps one silhouette and colour, from the first screen to the login, and only a reload
 * picks another. The eyes look from one side to the other while it waits.
 */
export function LoadingFace(props: LoadingFaceProps) {
  const size = props.size ?? 112;
  // The pick happens in the browser only, so a server render never mentions a face that the
  // client would then change. Every screen of this page load reads the same stored pick.
  const [picked, setPicked] = useState<LoadingAvatar | null>(null);
  useEffect(() => {
    setPicked(loadingAvatar());
  }, []);
  if (!picked) {
    return (
      <span
        className={cx("ui-loading-face", props.className)}
        style={{ display: "inline-block", width: `${size}px`, height: `${size}px` }}
        aria-hidden="true"
      />
    );
  }
  const profile = bloubAvatarProfile(props.seed ?? picked.seed, props.hue ?? picked.hue);
  return (
    <BloubBot
      size={size}
      shape={profile.shape}
      color={profile.color}
      // Wide, round eyes, the same face the favicon draws: the app is only loading.
      expression="surpris"
      cycle={FACE_CYCLE}
      initialPhase={0.05}
      playing={props.at === undefined}
      frozenAt={props.at}
      fps={30}
      gaze={sideGlance}
      ariaLabel=""
      className={cx("ui-loading-face", props.className)}
    />
  );
}
