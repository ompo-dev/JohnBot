"use client";

import React, { useEffect, useState } from "react";
import { LoadingFace } from "../components/loading-face";
import { createHybridjohnBot } from "../lib/api/bridges/create-hybrid";
import { installAnimatedFavicon } from "../lib/favicon";
import { createMockjohnBot } from "../preview/mock-johnbot";
import { DEMO_OPTIONS } from "../preview/demo-seed";

// The static/desktop preview is built with NEXT_PUBLIC_DATA_STACK=local and
// keeps the local mock. The default server build uses the HTTP data layer.
const useServerData = process.env.NEXT_PUBLIC_DATA_STACK !== "local";

function createBridge() {
  return useServerData ? createHybridjohnBot() : createMockjohnBot(DEMO_OPTIONS);
}

// Initialize the data bridge for browser development if running without desktop preload.
if (typeof window !== "undefined") {
  if (!(window as any).johnbot) {
    (window as any).johnbot = createBridge().api;
  }
  // Intercept createElement to catch undefined component types immediately
  const origCreate = React.createElement;
  (React as any).createElement = function (type: any, ...rest: any[]) {
    if (type === undefined) {
      const err = new Error("React.createElement recebeu type UNDEFINED!");
      console.error(err.message, err.stack);
    }
    return origCreate.apply(this, [type, ...rest] as any);
  };
  // Suppress legacy Solid JSX attribute warnings in React dev overlay
  const origError = console.error;
  console.error = (...args: any[]) => {
    const fullText = args
      .map((a) => (typeof a === "string" ? a : typeof a?.message === "string" ? a.message : ""))
      .join(" ");
    if (
      fullText.includes("Invalid DOM property") ||
      fullText.includes("Unknown event handler property") ||
      fullText.includes("Invalid event handler property") ||
      fullText.includes("React does not recognize the") ||
      fullText.includes("React uses onFocus and onBlur instead of") ||
      fullText.includes("unique \"key\" prop")
    ) {
      return;
    }
    origError.apply(console, args);
  };
}

class ClientErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: any; componentStack?: string }> {
  state = { error: null, componentStack: undefined };
  static getDerivedStateFromError(error: any) {
    return { error };
  }
  componentDidCatch(error: any, info: any) {
    console.error("ClientApp ErrorBoundary:", error, info);
    this.setState({ componentStack: info?.componentStack });
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-canvas text-red-500 p-8 overflow-auto">
          <h1 className="text-xl font-bold mb-4">Erro de Execução:</h1>
          <div className="font-semibold text-red-400 mb-2">{String((this.state.error as any)?.name || "Error")}: {String((this.state.error as any)?.message || this.state.error)}</div>
          <pre className="whitespace-pre-wrap max-w-4xl">{String((this.state.error as any)?.stack || this.state.error)}</pre>
          {this.state.componentStack && (
            <div className="mt-4 p-4 bg-black/40 rounded max-w-4xl w-full">
              <h2 className="text-sm font-semibold text-yellow-300 mb-2">Component Stack:</h2>
              <pre className="whitespace-pre-wrap text-xs text-yellow-200">{this.state.componentStack}</pre>
            </div>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ClientApp() {
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const stopFavicon = installAnimatedFavicon();
    if (typeof window !== "undefined") {
      // Ensure bridge exists
      if (!(window as any).johnbot) {
        (window as any).johnbot = createBridge().api;
      }
      import("@johnbot/ui/pointer-focus")
        .then(({ installPointerFocusGuard }) => installPointerFocusGuard?.())
        .catch(() => {});
      import("../hooks/appearance-choice")
        .then(({ syncAppearance }) => syncAppearance?.({ windowGlass: true }))
        .catch(() => {});
      import("../hooks/logo-color")
        .then(({ syncLogoColor }) => syncLogoColor?.())
        .catch(() => {});
      import("../hooks/action-sounds")
        .then(({ startActionSounds }) => startActionSounds?.())
        .catch(() => {});

      import("../App")
        .then((mod) => {
          setComponent(() => mod.default || mod.App);
        })
        .catch((err) => {
          console.error("Falha ao carregar ../App:", err);
          setError(err);
        });
    }
    return stopFavicon;
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-canvas text-red-500 p-8">
        <h1 className="text-xl font-bold mb-4">Erro ao carregar aplicação:</h1>
        <pre className="whitespace-pre-wrap">{String(error?.stack || error)}</pre>
      </div>
    );
  }

  if (!Component) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-canvas">
        <LoadingFace size={96} />
        <span className="sr-only">Loading johnBot...</span>
      </div>
    );
  }

  const AppComponent = Component;
  return (
    <ClientErrorBoundary>
      <AppComponent />
    </ClientErrorBoundary>
  );
}
