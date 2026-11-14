import { STORY_AGENT_SUMMARIES } from "../../preview/fixtures";
import { DEMO_OPTIONS } from "../../preview/demo-seed";
import { isReleasedRoutineSchedule } from "../../contracts/ipc-routines";
import type {
  AgentSubmission,
  AgentPublicationPreview,
} from "../../contracts/ipc-marketplace-agents";
import {
  agentSubmissionSchema,
  marketplaceDomainSchema,
  marketplacePublicationPreviewSchema,
  submitMarketplaceAgentSchema,
} from "../../contracts/marketplace-data";
import { cancelled, invalidInput } from "../errors";
import { updateDomain } from "../repositories/domain-store";
import { MARKETPLACE_DOMAIN, marketplaceSeed } from "../services/marketplace";
import type { CommandDefinition, RegisteredCommand } from "./types";

function seededPublicationPreview(agentId: string): AgentPublicationPreview | undefined {
  const agent = STORY_AGENT_SUMMARIES.find((candidate) => candidate.id === agentId);
  if (!agent) return undefined;
  return marketplacePublicationPreviewSchema.parse({
    agentId,
    name: agent.name,
    title: agent.title,
    description: agent.description,
    avatarSeed: agent.avatarSeed,
    avatarHue: agent.avatarHue,
    avatarUrl: agent.avatarUrl,
    skills: [],
    routines: (DEMO_OPTIONS.routines?.[agentId] ?? []).flatMap(
      ({ name, instruction, active, trigger }) =>
        isReleasedRoutineSchedule(trigger.schedule)
          ? [{ name, instruction, active, schedule: trigger.schedule }]
          : [],
    ),
  });
}

const submit: CommandDefinition = {
  payloadSchema: submitMarketplaceAgentSchema,
  resultSchema: agentSubmissionSchema,
  run: async (ctx, payload) => {
    if (ctx.signal.aborted) throw cancelled();
    const input = submitMarketplaceAgentSchema.parse(payload);
    const agent = input.preview ?? seededPublicationPreview(input.agentId);
    if (!agent) throw invalidInput("Choose a local agent or supply its demo publication preview.");
    if (agent.agentId !== input.agentId)
      throw invalidInput("The publication preview belongs to a different agent.");
    const submission: AgentSubmission = agentSubmissionSchema.parse({
      id: crypto.randomUUID(),
      listingId: input.listingId ?? `listing-${agent.agentId}`,
      name: agent.name,
      title: agent.title,
      description: agent.description,
      version: 1,
      status: "pending",
      rejectionNote: null,
      avatarSeed: agent.avatarSeed,
      avatarHue: agent.avatarHue,
      avatarUrl: agent.avatarUrl,
      skillCount: agent.skills.length,
      routineCount: agent.routines.length,
      activeRoutineCount: agent.routines.filter((routine) => routine.active).length,
      createdAt: new Date().toISOString(),
      category: input.category ?? "other",
      showCreatorAvatar: input.showCreatorAvatar ?? false,
    });
    await updateDomain(
      ctx.sessionId,
      MARKETPLACE_DOMAIN,
      marketplaceDomainSchema,
      marketplaceSeed,
      (current) => {
        return { ...current, submissions: [submission, ...current.submissions] };
      },
    );
    return submission;
  },
};
export const MARKETPLACE_DATA_COMMANDS: Readonly<Record<string, RegisteredCommand>> = {
  "marketplace.submit": { ...submit, idempotent: true },
};
