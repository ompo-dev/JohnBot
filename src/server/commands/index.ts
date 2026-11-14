import { ACCOUNT_COMMANDS, runRegisteredCommand } from "./account";
import { SETTINGS_COMMANDS } from "./settings";
import type { RegisteredCommand } from "./types";
import { AGENTS_DATA_COMMANDS } from "./agents";
import { WORKFLOWS_DATA_COMMANDS } from "./workflows";
import { MARKETPLACE_DATA_COMMANDS } from "./marketplace";
import { PREFERENCES_DATA_COMMANDS } from "./preferences";
import { JOB_COMMANDS } from "../jobs/service";
import { WORKSPACE_COMMANDS } from "./workspace";
import { OPERATIONS_COMMANDS } from "./operations";
import { ROUTINE_LAYOUT_COMMANDS } from "./routine-layout";

export const COMMANDS: Readonly<Record<string, RegisteredCommand>> = {
  ...OPERATIONS_COMMANDS,
  ...ROUTINE_LAYOUT_COMMANDS,
  ...WORKSPACE_COMMANDS,
  ...JOB_COMMANDS,
  ...ACCOUNT_COMMANDS,
  ...SETTINGS_COMMANDS,
  ...AGENTS_DATA_COMMANDS,
  ...WORKFLOWS_DATA_COMMANDS,
  ...MARKETPLACE_DATA_COMMANDS,
  ...PREFERENCES_DATA_COMMANDS,
};

export function findCommand(name: string): RegisteredCommand | undefined {
  return Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : undefined;
}

export { runRegisteredCommand };
