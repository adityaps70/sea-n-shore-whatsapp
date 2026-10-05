"use client";

import { useState } from "react";

type Props = {
  campaignId: string;
  status: string;
};

type SendResult = {
  ok?: boolean;
  sent?: number;
  failures?: unknown[];
  completed?: boolean;
  error?: unknown;
};

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function CampaignSendControl({ campaignId, status }: Props) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");

  const sendable = ["draft", "ready", "sending"].includes(status);

  async function sendAllRemaining() {
    if (!sendable || running) return;

    setRunning(true);
    let submitted = 0;
    let immediateFailures = 0;
    let batches = 0;
    let transientRetries = 0;

    try {
      while (true) {
        const response = await fetch("/api/campaigns/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId, limit: 10 }),
        });

        const raw = await response.text();
        let result: SendResult | null = null;

        try {
          result = raw ? (JSON.parse(raw) as SendResult) : null;
        } catch {
          result = null;
        }

        if (!response.ok || !result) {
          const transient =
            response.status >= 500 ||
            !result ||
            raw.trimStart().startsWith("<!DOCTYPE") ||
            raw.trimStart().startsWith("<html");

          if (transient && transientRetries < 5) {
            transientRetries += 1;
            setProgress(
              `Temporary gateway/server response. Waiting 15s before safe retry ${transientRetries}/5…`
            );

            // A timed-out request may have partially completed on the server.
            // Wait long enough for it to finish/terminate; the next request rereads
            // message rows and skips every contact already recorded.
            await sleep(15000);
            continue;
          }

          const apiError =
            result && typeof result.error === "string"
              ? result.error
              : `HTTP ${response.status || "error"}`;
          throw new Error(apiError);
        }

        transientRetries = 0;
        submitted += Number(result.sent || 0);
        immediateFailures += Array.isArray(result.failures) ? result.failures.length : 0;
        batches += 1;

        setProgress(
          `Submitted ${submitted} · immediate failures ${immediateFailures} · batch ${batches}`
        );

        if (result.completed) {
          setProgress(
            `Complete · submitted ${submitted} · immediate failures ${immediateFailures}`
          );
          window.setTimeout(() => window.location.reload(), 700);
          return;
        }

        // Keep server calls short while the browser continues automatically.
        await sleep(300);
      }
    } catch (error) {
      setProgress(
        `Stopped: ${error instanceof Error ? error.message : "unknown_error"}`
      );
    } finally {
      setRunning(false);
    }
  }

  if (!sendable) {
    return <span className="muted">{status === "completed" ? "Complete" : "Not sendable"}</span>;
  }

  return (
    <div>
      <button
        className="button"
        type="button"
        onClick={sendAllRemaining}
        disabled={running}
      >
        {running ? "Sending automatically…" : "Send all remaining"}
      </button>
      {progress ? (
        <span className="muted" style={{ display: "block", marginTop: 6 }}>
          {progress}
        </span>
      ) : null}
    </div>
  );
}
