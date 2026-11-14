import type { Metadata } from "next";
import "../styles.css";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { UrlStateProvider } from "../lib/url-state";
import { Suspense } from "react";
import { LoadingFace } from "../components/loading-face";

export const metadata: Metadata = {
  title: "johnBot",
  description: "JohnBot Desktop & Web Client",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-canvas text-primary antialiased">
        <Suspense
          fallback={
            <div className="grid h-screen w-screen place-items-center bg-canvas">
              <LoadingFace size={96} />
            </div>
          }
        >
          <NuqsAdapter><UrlStateProvider>{children}</UrlStateProvider></NuqsAdapter>
        </Suspense>
      </body>
    </html>
  );
}
