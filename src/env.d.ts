/// <reference types="vite/client" />

import type { johnBotDesktopApi } from "@johnbot/contracts/ipc";

declare global {
  interface HighlightRegistry {
    set(name: string, highlight: Highlight): this;
    delete(name: string): boolean;
  }

  interface Window {
    johnbot: johnBotDesktopApi;
  }
}
