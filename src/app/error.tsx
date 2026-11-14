"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Next.js Error:", error);
  }, [error]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-canvas text-primary">
      <h2 className="text-xl font-semibold">Algo deu errado!</h2>
      <p className="mt-2 text-sm text-secondary">{error.message}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-4 rounded-md bg-[var(--johnbot-accent)] px-4 py-2 text-sm text-primary"
      >
        Tentar novamente
      </button>
    </div>
  );
}
