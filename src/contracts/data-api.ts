import {
  APP_APPEARANCES,
  APP_FONT_FAMILY_PATTERN,
  APP_THEME_PALETTE_COLORS,
  APP_THEME_PALETTE_COLOR_PATTERN,
  APP_THEME_PALETTE_ID_PATTERN,
} from "./app-appearance";
import { APP_LANGUAGES } from "./app-language";
import { APP_INTERFACE_SIZES } from "./app-interface-size";
import { APP_LOGO_COLORS } from "./app-logo-color";
import { z } from "zod";

// Wire contracts for the server-backed slice of window.johnbot. Every request
// and every response crosses this file, so a handler cannot invent a shape the
// renderer does not know and the renderer cannot accept a shape the server did
// not validate.

const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const avatarMimeTypeSchema = z.enum(["image/png", "image/jpeg", "image/webp"]);

/** The avatar as it travels over JSON; the client converts Uint8Array to base64. */
export const avatarImageSchema = z.object({
  mimeType: avatarMimeTypeSchema,
  bytesBase64: z
    .string()
    .min(4)
    .max(349_528) // 256 KiB decoded, base64 is 4/3 of that plus padding
    .regex(/^[A-Za-z0-9+/]+={0,2}$/u),
});

export const authIssueSchema = z.object({
  code: z.string().min(1).max(120),
  message: z.string().min(1).max(2_000),
  retryAfterSeconds: z.number().int().nonnegative().optional(),
  reference: z.string().min(1).max(200).optional(),
});

export const authUserSchema = z.object({
  id: z.string().min(1).max(200),
  email: z.string().min(1).max(320),
  name: z.string().max(200).nullable(),
  avatarUrl: z.string().max(400_000).nullable(),
  analyticsEnabled: z.boolean().nullable().optional(),
  chatColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/u)
    .nullable()
    .optional(),
});

export const centralAuthStateSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("loading") }),
  z.object({
    status: z.literal("signed_out"),
    reason: z.literal("keyring_changed").optional(),
  }),
  z.object({ status: z.literal("signing_in") }),
  z.object({
    status: z.literal("code_sent"),
    challengeId: z.string().min(1).max(200),
    email: z.string().min(1).max(320),
    expiresAt: z.number(),
    resendAvailableAt: z.number(),
    developmentCode: z.string().min(1).max(40).optional(),
    issue: authIssueSchema.optional(),
  }),
  z.object({
    status: z.literal("company_sign_in"),
    email: z.string().min(1).max(320),
    issue: authIssueSchema.optional(),
  }),
  z.object({ status: z.literal("signed_in"), user: authUserSchema }),
  z.object({ status: z.literal("error"), issue: authIssueSchema }),
]);

export const accountSessionSchema = z.object({
  sessionId: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  kind: z.enum(["desktop", "mobile"]),
  current: z.boolean(),
  connectedAt: z.number(),
  lastActiveAt: z.number(),
  hostedServer: z.boolean().optional(),
});

export const accountSessionsResponseSchema = z.object({
  sessions: z.array(accountSessionSchema).max(100),
});

export const accountUsageWindowSchema = z.object({
  usedPercent: z.number(),
  windowDurationMins: z.number().int().nonnegative().nullable(),
  resetsAt: z.number().nullable(),
});

export const accountUsageGroupSchema = z.object({
  name: z.string().min(1).max(200),
  models: z.array(z.string().min(1).max(200)).max(200),
  primary: accountUsageWindowSchema.nullable(),
  secondary: accountUsageWindowSchema.nullable(),
});

export const accountUsageLimitSchema = z.object({
  id: z.string().min(1).max(200),
  accountId: z.string().min(1).max(200).optional(),
  primary: accountUsageWindowSchema.nullable(),
  secondary: accountUsageWindowSchema.nullable(),
  tertiary: accountUsageWindowSchema.optional(),
  groups: z.array(accountUsageGroupSchema).max(100).optional(),
  sharedQuotaWith: z.string().min(1).max(120).optional(),
});

export const accountUsageSchema = z.object({
  limits: z.array(accountUsageLimitSchema).max(200),
});

export const appInfoSchema = z.object({
  name: z.string().min(1).max(200),
  version: z.string().min(1).max(100),
  platform: z.enum(["darwin", "win32", "linux"]),
  variant: z.enum(["production", "dev", "preview"]),
  analyticsCaptureUrl: z.string().max(2_000).optional(),
  analyticsInstallId: z.string().max(200).optional(),
  softwareRendering: z.boolean().optional(),
  hourCycle: z.enum(["h12", "h23"]).optional(),
  aboveAppsSupport: z.enum(["restart", "unsupported"]).optional(),
});

// Settings. The desktop owns these locally; the preview persists them per session so the
// same contracts and commands can be exercised without pretending to be the native process.

export const appLanguageSchema = z.enum(APP_LANGUAGES);
export const appLogoColorSchema = z.enum(APP_LOGO_COLORS);
export const appAppearanceSchema = z.enum(APP_APPEARANCES);
export const appInterfaceSizeSchema = z.union(APP_INTERFACE_SIZES.map((size) => z.literal(size)));

const appThemePaletteColorSchema = z.string().regex(APP_THEME_PALETTE_COLOR_PATTERN);
const appFontFamilySchema = z.string().regex(APP_FONT_FAMILY_PATTERN).nullable();

export const appThemePaletteSchema = z.object({
  id: z.string().regex(APP_THEME_PALETTE_ID_PATTERN),
  name: z.string().min(1).max(200),
  scheme: z.enum(["light", "dark"]),
  colors: z.record(z.enum(APP_THEME_PALETTE_COLORS), appThemePaletteColorSchema),
});

export const appAppearancePreferenceSchema = z.object({
  appearance: appAppearanceSchema,
  palette: z.string().regex(APP_THEME_PALETTE_ID_PATTERN).nullable(),
  palettes: z.array(appThemePaletteSchema).max(100),
  transparentWindow: z.boolean(),
  chatBackgroundLight: z.string().regex(/^#[0-9A-Fa-f]{6}$/u).nullable(),
  chatBackgroundDark: z.string().regex(/^#[0-9A-Fa-f]{6}$/u).nullable(),
  interfaceFont: appFontFamilySchema,
  codeFont: appFontFamilySchema,
});

export const appLanguagePreferenceSchema = z.object({ language: appLanguageSchema });
export const appLogoColorPreferenceSchema = z.object({ color: appLogoColorSchema });
export const appInterfaceSizePreferenceSchema = z.object({ percent: appInterfaceSizeSchema });

export const settingsSnapshotSchema = z.object({
  language: appLanguagePreferenceSchema,
  logoColor: appLogoColorPreferenceSchema,
  appearance: appAppearancePreferenceSchema,
  interfaceSize: appInterfaceSizePreferenceSchema,
});

export const setLanguagePayloadSchema = appLanguagePreferenceSchema;
export const setLogoColorPayloadSchema = appLogoColorPreferenceSchema;
export const setInterfaceSizePayloadSchema = appInterfaceSizePreferenceSchema;
export const setAppearancePayloadSchema = z
  .object({
    appearance: appAppearanceSchema.optional(),
    transparentWindow: z.boolean().optional(),
    palette: z.string().regex(APP_THEME_PALETTE_ID_PATTERN).nullable().optional(),
    chatBackgroundLight: z.string().regex(/^#[0-9A-Fa-f]{6}$/u).nullable().optional(),
    chatBackgroundDark: z.string().regex(/^#[0-9A-Fa-f]{6}$/u).nullable().optional(),
    interfaceFont: appFontFamilySchema.optional(),
    codeFont: appFontFamilySchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one appearance field is required." });

// Payloads. These are the allowlist: the route looks the command up in
// DATA_COMMAND_CONTRACTS and rejects anything else before a handler runs.

export const requestEmailCodePayloadSchema = z.object({ email: z.email().max(320) });

export const verifyEmailCodePayloadSchema = z.object({
  challengeId: boundedText(200),
  code: z.string().trim().min(1).max(40),
});

export const updateNamePayloadSchema = z.object({ name: boundedText(120) });

export const updateAvatarPayloadSchema = z.object({ image: avatarImageSchema.nullable() });

export const revokeSessionPayloadSchema = z.object({ sessionId: boundedText(200) });

export const DATA_COMMANDS = {
  requestEmailCode: "account.request-email-code",
  verifyEmailCode: "account.verify-email-code",
  updateName: "account.update-name",
  updateAvatar: "account.update-avatar",
  logout: "account.logout",
  revokeSession: "account.revoke-session",
  setLanguage: "settings.set-language",
  setLogoColor: "settings.set-logo-color",
  setAppearance: "settings.set-appearance",
  setInterfaceSize: "settings.set-interface-size",
} as const;

export type DataCommand = (typeof DATA_COMMANDS)[keyof typeof DATA_COMMANDS];

/** The response body of every command is the resulting account state, session list, or settings. */
export const commandResultSchema = z.union([
  centralAuthStateSchema,
  z.object({ sessions: z.array(accountSessionSchema).max(100) }),
  settingsSnapshotSchema,
]);

export const dataErrorCodeSchema = z.enum([
  "invalid_input",
  "unauthorized",
  "not_found",
  "conflict",
  "idempotency_conflict",
  "idempotency_in_progress",
  "storage_unavailable",
  "upstream_unavailable",
  "cancelled",
  "internal_error",
]);

export type DataErrorCode = z.infer<typeof dataErrorCodeSchema>;

export const dataErrorBodySchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: dataErrorCodeSchema,
    message: z.string().min(1).max(2_000),
    requestId: z.string().min(1).max(200),
    retryAfterSeconds: z.number().int().nonnegative().optional(),
    details: z.unknown().optional(),
  }),
});

export const dataSuccessBodySchema = z.object({
  ok: z.literal(true),
  data: z.unknown(),
});

export type DataErrorBody = z.infer<typeof dataErrorBodySchema>;

export const IDEMPOTENCY_HEADER = "idempotency-key";
export const IDEMPOTENCY_REPLAYED_HEADER = "idempotency-replayed";
export const REQUEST_ID_HEADER = "x-request-id";
export const DATA_CACHE_HEADER = "x-data-generated-at";

export const idempotencyKeySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/u);

export type AppInfo = z.infer<typeof appInfoSchema>;
export type CentralAuthState = z.infer<typeof centralAuthStateSchema>;
export type AccountSession = z.infer<typeof accountSessionSchema>;
export type AccountUsage = z.infer<typeof accountUsageSchema>;
export type AvatarImage = z.infer<typeof avatarImageSchema>;
export type RequestEmailCodePayload = z.infer<typeof requestEmailCodePayloadSchema>;
export type VerifyEmailCodePayload = z.infer<typeof verifyEmailCodePayloadSchema>;
export type UpdateNamePayload = z.infer<typeof updateNamePayloadSchema>;
export type UpdateAvatarPayload = z.infer<typeof updateAvatarPayloadSchema>;
export type RevokeSessionPayload = z.infer<typeof revokeSessionPayloadSchema>;
export type SettingsSnapshot = z.infer<typeof settingsSnapshotSchema>;
export type AppLanguagePreference = z.infer<typeof appLanguagePreferenceSchema>;
export type AppLogoColorPreference = z.infer<typeof appLogoColorPreferenceSchema>;
export type AppAppearancePreference = z.infer<typeof appAppearancePreferenceSchema>;
export type AppInterfaceSizePreference = z.infer<typeof appInterfaceSizePreferenceSchema>;
export type SetLanguagePayload = z.infer<typeof setLanguagePayloadSchema>;
export type SetLogoColorPayload = z.infer<typeof setLogoColorPayloadSchema>;
export type SetAppearancePayload = z.infer<typeof setAppearancePayloadSchema>;
export type SetInterfaceSizePayload = z.infer<typeof setInterfaceSizePayloadSchema>;
