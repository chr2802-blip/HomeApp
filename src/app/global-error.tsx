"use client";

import { useEffect } from "react";

/**
 * The last resort. The error boundary inside the app shell handles anything thrown by
 * a page; this one catches failures in the root layout itself, where that boundary does
 * not exist yet. It has to render its own <html> and cannot rely on any app styling,
 * because the failure may be the reason none of it loaded.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        level: "error",
        event: "global_error",
        message: error.message,
        digest: error.digest,
        stack: error.stack,
      }),
    );
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <div style={{ maxWidth: "22rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>HomeHub could not load</h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#475569" }}>
            Something failed before the app could start. Trying again often clears it.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#0f172a",
              color: "white",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
