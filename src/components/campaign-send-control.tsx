"use client";

import { useState } from "react";

type Props = {
  campaignId: string;
  status: string;
};

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

    try {
      while (true) {
        const response = await fetch("/api/campaigns/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId, limit: 25 }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(
            typeof result?.error === "string" ? result.error : "campaign_send_failed"
          );
        }

        submitted += Number(result?.sent || 0);
        immediateFailures += Array.isArray(result?.failures) ? result.failures.length : 0;
        batches += 1;

        setProgress(
          `Submitted ${submitted} · immediate failures ${immediateFailures} · batch ${batches}`
        );

        if (result?.completed) {
          setProgress(
            `Complete · submitted ${submitted} · immediate failures ${immediateFailures}`
          );
          window.setTimeout(() => window.location.reload(), 700);
          return;
        }

        // Keep the existing conservative 25-contact batch size, but continue automatically.
        await new Promise((resolve) => window.setTimeout(resolve, 300));
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
