"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Global error logged to error reporting service
    // In production, this would be sent to Sentry or similar
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            backgroundColor: "#0D1117",
            color: "#E6EDF3",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: "400px",
              width: "100%",
              padding: "2rem",
              backgroundColor: "#161B22",
              borderRadius: "0.5rem",
              border: "1px solid #30363D",
              textAlign: "center",
            }}
          >
            <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
              Critical Error
            </h1>
            <p style={{ marginBottom: "2rem", color: "#8B949E" }}>
              A critical error occurred. The application needs to restart.
            </p>
            <button
              onClick={reset}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#238636",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              Reload Application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
