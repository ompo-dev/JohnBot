import { installPointerFocusGuard } from "@johnbot/ui/pointer-focus";
import { render } from "@solidjs/web";
import { isTauri } from "@tauri-apps/api/core";
import { TelemetryApp } from "../features/telemetry/TelemetryApp";
import { TelemetryNativeApp } from "../features/telemetry/TelemetryNativeApp";
import { StaticI18nProvider } from "./i18n-context";

const root = document.getElementById("root");
if (!root) throw new Error("Telemetry renderer root was not found.");
installPointerFocusGuard();
render(
  () => <StaticI18nProvider locale="pt">{isTauri() ? <TelemetryNativeApp /> : <TelemetryApp />}</StaticI18nProvider>,
  root,
);
