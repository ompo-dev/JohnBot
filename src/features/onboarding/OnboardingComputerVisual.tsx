import { AgentAvatar } from "@johnbot/features/agents/AgentAvatar";
import type { OnboardingAvatarVariant } from "./onboarding-avatars";

/** The picture of the computer step: an agent drags a window across a desktop. */
export function OnboardingComputerVisual(props: { avatar: OnboardingAvatarVariant }) {
  return (
    <div className="onboarding-computer-visual" aria-hidden="true">
      <svg viewBox="0 0 400 240" role="presentation">
        <defs>
          <linearGradient id="onboarding-computer-desktop-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop className="onboarding-computer-stop-mist" offset="0" />
            <stop className="onboarding-computer-stop-blue" offset="0.56" />
            <stop className="onboarding-computer-stop-indigo" offset="1" />
          </linearGradient>
          <radialGradient id="onboarding-computer-desktop-highlight" cx="0.18" cy="0.12" r="0.9">
            <stop className="onboarding-computer-highlight-start" offset="0" />
            <stop className="onboarding-computer-highlight-end" offset="1" />
          </radialGradient>
        </defs>
        <rect
          className="onboarding-computer-desktop"
          x="12"
          y="12"
          width="376"
          height="216"
          rx="24"
          fill="url(#onboarding-computer-desktop-gradient)"
        />
        <rect
          className="onboarding-computer-desktop-highlight"
          x="12"
          y="12"
          width="376"
          height="216"
          rx="24"
          fill="url(#onboarding-computer-desktop-highlight)"
        />
        <path className="onboarding-computer-desktop-beam" d="M214 12h92l-78 216H112z" />
        <g className="onboarding-computer-window">
          <rect className="onboarding-computer-window-shadow" x="80" y="59" width="256" height="146" rx="14" />
          <rect className="onboarding-computer-window-body" x="72" y="48" width="256" height="146" rx="14" />
          <rect className="onboarding-computer-window-bar" x="72" y="48" width="256" height="30" rx="14" />
          <rect className="onboarding-computer-window-bar-fill" x="72" y="63" width="256" height="15" />
          <circle className="onboarding-computer-dot onboarding-computer-dot-danger" cx="91" cy="63" r="4" />
          <circle className="onboarding-computer-dot onboarding-computer-dot-warning" cx="104" cy="63" r="4" />
          <circle className="onboarding-computer-dot onboarding-computer-dot-success" cx="117" cy="63" r="4" />
          <rect className="onboarding-computer-window-pane" x="90" y="94" width="64" height="78" rx="8" />
          <rect className="onboarding-computer-window-card" x="170" y="94" width="138" height="14" rx="7" />
          <rect className="onboarding-computer-window-line" x="170" y="122" width="108" height="7" rx="3.5" />
          <rect
            className="onboarding-computer-window-line onboarding-computer-window-line-short"
            x="170"
            y="139"
            width="78"
            height="7"
            rx="3.5"
          />
          <rect className="onboarding-computer-window-card" x="170" y="161" width="118" height="10" rx="5" />
        </g>
        <g className="onboarding-computer-cursor">
          <path d="M1.5 1.5v24.8l6.7-6.1 5.5 12.6 5.7-2.5-5.5-12.4h9.6z" />
        </g>
      </svg>
      <div className="onboarding-computer-avatar">
        <AgentAvatar
          seed={props.avatar.seed}
          hue={props.avatar.hue}
          motion="idle"
          animationOffset={props.avatar.animationOffset}
          className="onboarding-computer-avatar-agent"
        />
      </div>
    </div>
  );
}
