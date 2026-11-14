import React from "react";
import ReactDOMServer from "react-dom/server";
import { createMockjohnBot } from "../../src/preview/mock-johnbot";
import { DEMO_OPTIONS } from "../../src/preview/demo-seed";

// Set up mock window and johnbot bridge
(globalThis as any).window = globalThis;
(globalThis as any).document = {
  hasFocus: () => true,
  title: "",
  head: { appendChild: () => {} },
  getElementsByTagName: () => [{ appendChild: () => {} }],
  createElement: () => ({ appendChild: () => {}, style: {} }),
  body: { appendChild: () => {} },
};
(globalThis as any).johnbot = createMockjohnBot(DEMO_OPTIONS).api;

async function run() {
  try {
    const AppViewModule = await import("../../src/AppView");
    const AppView = AppViewModule.default || AppViewModule.AppView;
    console.log("AppView loaded, rendering...");
    const html = ReactDOMServer.renderToString(React.createElement(AppView));
    console.log("Render success! HTML length:", html.length);
  } catch (err: any) {
    console.error("TEST RENDER ERROR CAUGHT:");
    console.error(err);
    if (err.stack) console.error(err.stack);
  }
}

run();
