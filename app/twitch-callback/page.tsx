"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function CallbackContent() {
  const params = useSearchParams();
  const code = params.get("code") ?? "";
  return (
    <div className="cg-shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
      <div className="cg-panel" style={{ width: "min(480px, 100%)", textAlign: "center" }}>
        <div className="cg-eyebrow">TWITCH OAUTH</div>
        <h2 style={{ margin: "0 0 8px", fontSize: "19px" }}>Authorization received</h2>
        <p style={{ margin: "0 0 18px", fontSize: "13px", color: "var(--muted)", lineHeight: 1.6 }}>
          Copy the code below and paste it into the <b>setup-twitch.mjs</b> terminal
          prompt, then return here afterwards — you can close this tab.
        </p>
        <textarea
          readOnly
          value={code}
          onFocus={(event) => event.currentTarget.select()}
          style={{
            width: "100%",
            minHeight: "96px",
            fontFamily: "monospace",
            fontSize: "12px",
            padding: "12px",
            background: "var(--bg-2)",
            border: "1px solid var(--line)",
            borderRadius: "10px",
            color: "var(--ink)",
          }}
        />
        {!code && (
          <p style={{ margin: "14px 0 0", fontSize: "12px", color: "var(--amber)" }}>
            No code in the URL — did you complete the Twitch authorization?
          </p>
        )}
      </div>
    </div>
  );
}

export default function TwitchCallbackPage() {
  return (
    <Suspense>
      <CallbackContent />
    </Suspense>
  );
}
