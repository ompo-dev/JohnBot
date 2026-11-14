import { preferencesDataSchema, seedPreferencesData } from "../../contracts/preferences-data";
import { readDomain, updateDomain } from "../repositories/domain-store";

export const PREFERENCES_DOMAIN = "preferences";
export const readPreferencesData = (sessionId: string) =>
  readDomain(sessionId, PREFERENCES_DOMAIN, preferencesDataSchema, seedPreferencesData);
export const updatePreferencesData = (
  sessionId: string,
  change: (
    current: ReturnType<typeof seedPreferencesData>,
  ) => ReturnType<typeof seedPreferencesData>,
) =>
  updateDomain(sessionId, PREFERENCES_DOMAIN, preferencesDataSchema, seedPreferencesData, change);
