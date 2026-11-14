import {
  setAppearancePayloadSchema,
  setInterfaceSizePayloadSchema,
  setLanguagePayloadSchema,
  setLogoColorPayloadSchema,
  settingsSnapshotSchema,
} from "../../contracts/data-api";
import { cancelled } from "../errors";
import { updateSnapshot } from "../repositories/session-store";
import type { CommandDefinition, RegisteredCommand } from "./types";

function assertActive(signal: AbortSignal): void {
  if (signal.aborted) throw cancelled();
}

const setLanguage: CommandDefinition = {
  payloadSchema: setLanguagePayloadSchema,
  resultSchema: settingsSnapshotSchema,
  run: async (ctx, payload) => {
    const input = setLanguagePayloadSchema.parse(payload);
    assertActive(ctx.signal);
    const snapshot = await updateSnapshot(ctx.sessionId, (current) => ({
      ...current,
      settings: { ...current.settings, language: input },
    }));
    return snapshot.settings;
  },
};

const setLogoColor: CommandDefinition = {
  payloadSchema: setLogoColorPayloadSchema,
  resultSchema: settingsSnapshotSchema,
  run: async (ctx, payload) => {
    const input = setLogoColorPayloadSchema.parse(payload);
    assertActive(ctx.signal);
    const snapshot = await updateSnapshot(ctx.sessionId, (current) => ({
      ...current,
      settings: { ...current.settings, logoColor: input },
    }));
    return snapshot.settings;
  },
};

const setInterfaceSize: CommandDefinition = {
  payloadSchema: setInterfaceSizePayloadSchema,
  resultSchema: settingsSnapshotSchema,
  run: async (ctx, payload) => {
    const input = setInterfaceSizePayloadSchema.parse(payload);
    assertActive(ctx.signal);
    const snapshot = await updateSnapshot(ctx.sessionId, (current) => ({
      ...current,
      settings: { ...current.settings, interfaceSize: input },
    }));
    return snapshot.settings;
  },
};

const setAppearance: CommandDefinition = {
  payloadSchema: setAppearancePayloadSchema,
  resultSchema: settingsSnapshotSchema,
  run: async (ctx, payload) => {
    const input = setAppearancePayloadSchema.parse(payload);
    assertActive(ctx.signal);
    const snapshot = await updateSnapshot(ctx.sessionId, (current) => {
      const next = { ...current.settings.appearance, ...input };
      const palette = next.palette === null || next.palettes.some((item) => item.id === next.palette)
        ? next.palette
        : null;
      return {
        ...current,
        settings: { ...current.settings, appearance: { ...next, palette } },
      };
    });
    return snapshot.settings;
  },
};

export const SETTINGS_COMMANDS: Readonly<Record<string, RegisteredCommand>> = {
  "settings.set-language": { ...setLanguage, idempotent: true },
  "settings.set-logo-color": { ...setLogoColor, idempotent: true },
  "settings.set-interface-size": { ...setInterfaceSize, idempotent: true },
  "settings.set-appearance": { ...setAppearance, idempotent: true },
};
