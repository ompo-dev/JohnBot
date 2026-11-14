import { Button } from "@johnbot/ui";
import type { AgentProfile } from "@johnbot/ui/data";
import { AgentAvatar } from "@johnbot/features/agents/AgentAvatar";
import { StopIcon } from "@johnbot/features/conversation/ConversationIcons";
import { VoiceWaveform } from "@johnbot/features/conversation/VoiceRecordingMorph";
import { useText } from "@johnbot/ui/text";

export interface SpeakingBarProps {
  agent: AgentProfile;
  /** The part of the reply that plays now. */
  caption: string;
  /** The loudness of the voice, oldest first, from 0 to 1. */
  levels: readonly number[];
  onStop: () => void;
}

/** Above the composer while a reply is read aloud: the agent, its voice, the part that plays now, and Stop. */
export function SpeakingBar(props: SpeakingBarProps) {
  const { t } = useText();
  return (
    <section className="speaking-bar" aria-label={t("conversation.speech.label", { name: props.agent.name })}>
      <AgentAvatar agent={props.agent} mood="responded" motion="always" className="speaking-bar-avatar" />
      <VoiceWaveform levels={props.levels} className="speaking-bar-waveform" />
      <p className="speaking-bar-caption">{props.caption}</p>
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        className="speaking-bar-stop"
        aria-label={t("conversation.speech.stop")}
        title={t("conversation.speech.stop")}
        onClick={() => props.onStop()}
      >
        <StopIcon />
      </Button>
    </section>
  );
}
