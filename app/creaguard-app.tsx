"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SignInButton,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import type {
  ChannelName,
  Connections,
  Incident,
  Policy,
  PolicyProposal,
  RiskCategory,
  SystemStatus,
} from "@/lib/types";
import { parseRecommendedAction } from "@/lib/minds";
import { Icon } from "./icons";

type View = "overview" | "incidents" | "policy" | "settings";

const categoryLabels: Record<RiskCategory, string> = {
  threat: "Threat",
  doxxing: "Doxxing",
  impersonation: "Impersonation",
  scam: "Scam",
  harassment: "Harassment",
  criticism: "Criticism",
  other: "Unclassified",
};

const categoryTone: Record<RiskCategory, string> = {
  threat: "critical",
  doxxing: "critical",
  impersonation: "high",
  scam: "high",
  harassment: "high",
  criticism: "safe",
  other: "neutral",
};

const categoryIcon: Record<RiskCategory, string> = {
  threat: "alert-triangle",
  doxxing: "eye-off",
  impersonation: "user-x",
  scam: "dollar-sign",
  harassment: "flag",
  criticism: "message-square",
  other: "circle",
};

function relativeTime(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Turns the Mind's HTML-formatted reply into readable plain text. */
function mindReplyToText(html: string): string {
  return html
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|ul|ol|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function AuthArea({ onAuthChange }: { onAuthChange: () => void }) {
  const { isSignedIn } = useAuth();
  const previous = useRef(isSignedIn);
  useEffect(() => {
    if (previous.current !== isSignedIn) {
      previous.current = isSignedIn;
      onAuthChange();
    }
  }, [isSignedIn, onAuthChange]);
  return (
    <>
      {isSignedIn ? (
        <UserButton />
      ) : (
        <SignInButton mode="modal">
          <button className="cg-btn ghost" type="button">
            Sign in
          </button>
        </SignInButton>
      )}
    </>
  );
}

export function CreaGuardApp({ clerkEnabled = false }: { clerkEnabled?: boolean }) {
  const [view, setView] = useState<View>("overview");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composer, setComposer] = useState({ message: "", authorId: "", platform: "manual" });
  const [submitting, setSubmitting] = useState(false);
  const [policyDraft, setPolicyDraft] = useState("");
  const [policySaving, setPolicySaving] = useState(false);
  const [toast, setToast] = useState<{ title: string; copy: string } | null>(null);
  const [mindsReply, setMindsReply] = useState<string | null>(null);
  const [mindsState, setMindsState] = useState<"idle" | "pending" | "reply" | "error">("idle");
  const [mindsReload, setMindsReload] = useState(0);
  const [decisionNote, setDecisionNote] = useState("");
  const [proposals, setProposals] = useState<PolicyProposal[]>([]);
  const [proposalBusy, setProposalBusy] = useState(false);
  const [connections, setConnections] = useState<Connections>({
    platforms: [],
    onboardingDone: false,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [incidentsRes, policyRes, statusRes, proposalsRes, connRes] =
        await Promise.all([
          fetch("/api/incidents", { cache: "no-store" }),
          fetch("/api/policy", { cache: "no-store" }),
          fetch("/api/health", { cache: "no-store" }),
          fetch("/api/policy/proposals", { cache: "no-store" }),
          fetch("/api/connections", { cache: "no-store" }),
        ]);
      if (!incidentsRes.ok || !policyRes.ok || !statusRes.ok) {
        throw new Error("Failed to load workspace data.");
      }
      const incidentsData = (await incidentsRes.json()) as { incidents: Incident[] };
      const policyData = (await policyRes.json()) as { policy: Policy };
      const statusData = (await statusRes.json()) as { status: SystemStatus };
      const proposalsData = proposalsRes.ok
        ? ((await proposalsRes.json()) as { proposals: PolicyProposal[] })
        : { proposals: [] as PolicyProposal[] };
      const connData = connRes.ok
        ? ((await connRes.json()) as { connections: Connections })
        : null;
      setIncidents(incidentsData.incidents);
      setPolicy(policyData.policy);
      setPolicyDraft(policyData.policy.content);
      setStatus(statusData.status);
      setProposals(proposalsData.proposals);
      if (connData) setConnections(connData.connections);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspace data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timeout);
  }, [toast]);

  const selected = useMemo(
    () => incidents.find((item) => item.id === selectedId) ?? null,
    [incidents, selectedId],
  );

  // Prefer the reply cached on the incident (instant on revisit and after
  // a status change) over the in-flight polling state.
  const shownMindsReply = mindsReply ?? selected?.mindsReply ?? null;
  const selectedPlatform = selected?.events.at(-1)?.platform ?? null;
  const enforceEnabled =
    selectedPlatform === "discord" || selectedPlatform === "telegram";

  useEffect(() => {
    if (!selectedId) {
      setMindsReply(null);
      setMindsState("idle");
      setDecisionNote("");
      return;
    }
    setDecisionNote("");
    let cancelled = false;
    async function loadMindsReply() {
      setMindsState("pending");
      for (let attempt = 0; attempt < 24; attempt += 1) {
        if (cancelled) return;
        try {
          const res = await fetch(`/api/incidents/${selectedId}`, { cache: "no-store" });
          if (!res.ok) throw new Error("Failed to load case.");
          const data = (await res.json()) as {
            incident?: Incident;
            minds?: { connected?: boolean; reply?: string; error?: string };
          };
          // Cached reply: instant on revisit.
          if (data.incident?.mindsReply) {
            setMindsReply(data.incident.mindsReply);
            setMindsState("reply");
            return;
          }
          // Low-risk cases are never relayed — stop polling right away
          // instead of spinning for a full minute for a reply that can't come.
          if (!data.incident?.mindsAlias) {
            setMindsState("idle");
            return;
          }
          if (data.minds?.reply) {
            setMindsReply(data.minds.reply);
            setMindsState("reply");
            return;
          }
          if (data.minds?.error && attempt >= 2) {
            setMindsState("error");
            return;
          }
        } catch {
          if (cancelled) return;
        }
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
      if (!cancelled) setMindsState("idle");
    }
    void loadMindsReply();
    return () => {
      cancelled = true;
    };
  }, [selectedId, mindsReload]);

  // Show only incidents from connected channels. With zero channels
  // connected the dashboard is empty — a creator must connect before any
  // data appears (that's the point of the connect flow).
  const visibleIncidents = useMemo(() => {
    const connected = new Set<ChannelName>(connections.platforms);
    return incidents.filter((item) => {
      const platform = item.events.at(-1)?.platform;
      return (
        !platform ||
        platform === "manual" ||
        connected.has(platform as ChannelName)
      );
    });
  }, [incidents, connections.platforms]);
  const noChannelsConnected =
    connections.onboardingDone && connections.platforms.length === 0;

  const needsReview = visibleIncidents.filter((item) => item.status === "needs_review").length;
  const monitoring = visibleIncidents.filter((item) => item.status === "monitoring").length;
  const quarantined = visibleIncidents.filter((item) => item.status === "quarantined").length;
  const resolved = visibleIncidents.filter((item) => item.status === "resolved").length;

  async function submitIncident() {
    if (!composer.message.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: composer.message,
          authorId: composer.authorId,
          platform: composer.platform,
        }),
      });
      const data = (await res.json()) as { incident?: Incident; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create incident.");
      }
      setComposer({ message: "", authorId: "", platform: "manual" });
      setComposerOpen(false);
      await refresh();
      setToast({
        title: "Incident created",
        copy: `${data.incident?.externalId ?? "New case"} was analyzed and stored.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create incident.");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateIncident(nextStatus: string, relayToMinds = false, note = "") {
    if (!selected) return;
    try {
      const res = await fetch(`/api/incidents/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          relayToMinds,
          decisionNote: note || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to update case.");
      }
      await refresh();
      setDecisionNote("");
      // After relaying a case, re-poll so the new Mind reply appears.
      if (relayToMinds) setMindsReload((value) => value + 1);
      const taught = note && (nextStatus === "resolved" || nextStatus === "dismissed");
      setToast({
        title: "Case updated",
        copy: `${selected.externalId} is now ${nextStatus.replace("_", " ")}${taught ? ". Your Mind was taught this decision." : "."}`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update case.");
    }
  }

  const suspectIncidents = useMemo(() => {
    if (!selected?.suspectId) return [];
    return visibleIncidents.filter((item) => item.suspectId === selected.suspectId);
  }, [visibleIncidents, selected]);
  const suspectPlatforms = useMemo(() => {
    const set = new Set<string>();
    for (const item of suspectIncidents) {
      const platform = item.events.at(-1)?.platform;
      if (platform) set.add(platform);
    }
    return [...set];
  }, [suspectIncidents]);

  async function enforceIncident(action: "ban" | "timeout" | "delete") {
    if (!selected) return;
    const platform = selected.events.at(-1)?.platform ?? "this platform";
    const verb =
      action === "ban"
        ? "ban this user"
        : action === "timeout"
          ? "timeout this user for 24 hours"
          : "delete the offending message";
    if (
      !window.confirm(
        `This will ${verb} on ${platform}. It is real and irreversible. Continue?`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/incidents/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enforce: action }),
      });
      const data = (await res.json()) as {
        enforcement?: { ok?: boolean; detail?: string };
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Enforcement failed.");
      if (!data.enforcement?.ok) {
        throw new Error(data.enforcement?.detail ?? "Enforcement failed.");
      }
      await refresh();
      setDecisionNote("");
      setToast({
        title: "Action taken",
        copy: `${action} executed on ${platform}. Case resolved and your Mind was taught this decision.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enforcement failed.");
    }
  }

  async function askMindForProposal() {
    setProposalBusy(true);
    try {
      const res = await fetch("/api/policy/proposals", { method: "POST" });
      const data = (await res.json()) as {
        thinking?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Your Mind could not be reached.");
      setToast({
        title: "Your Mind is drafting a proposal",
        copy: "It reviews your recent decisions, then the proposal appears here.",
      });
      // Poll until the Mind's reply materializes (arrives asynchronously).
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const pollRes = await fetch("/api/policy/proposals", { cache: "no-store" });
        const pollData = (await pollRes.json()) as { proposals: PolicyProposal[] };
        const drafted = pollData.proposals.find(
          (proposal) => proposal.status === "pending" && proposal.content,
        );
        if (drafted) {
          setProposals(pollData.proposals);
          setToast({
            title: "Your Mind proposed a change",
            copy: "Approve it to apply, or reject to keep the current policy.",
          });
          return;
        }
      }
      await refresh();
      setToast({
        title: "Still drafting",
        copy: "Your Mind is taking a while — the proposal will appear when it's ready.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to ask your Mind.");
    } finally {
      setProposalBusy(false);
    }
  }

  async function decideProposal(proposalId: string, approve: boolean) {
    try {
      const res = await fetch("/api/policy/proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proposalId, approve }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to update proposal.");
      await refresh();
      setToast({
        title: approve ? "Policy updated by your Mind" : "Proposal rejected",
        copy: approve
          ? "The proposed policy is now active."
          : "The proposal was dismissed; policy unchanged.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update proposal.");
    }
  }

  const reopenWizard = useCallback(() => {
    void fetch("/api/connections", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingDone: false }),
    }).then(() => refresh());
  }, [refresh]);

  async function savePolicyNow() {
    setPolicySaving(true);
    try {
      const res = await fetch("/api/policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: policyDraft }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to save policy.");
      }
      await refresh();
      setToast({ title: "Policy saved", copy: "Your safety boundaries are now active." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save policy.");
    } finally {
      setPolicySaving(false);
    }
  }

  return (
    <div className="cg-shell">
      <header className="cg-topbar">
        <div className="cg-topbar-left">
          <a href="/" className="cg-brand-link">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="CreaGuard logo" className="cg-logo-img" />
            <div className="cg-brand">CreaGuard</div>
          </a>
          <nav className="cg-mainnav">
            {(["overview", "incidents", "policy", "settings"] as View[]).map((item) => (
              <button
                key={item}
                className={`cg-mainnav-item ${view === item ? "active" : ""}`}
                onClick={() => setView(item)}
              >
                {item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </nav>
        </div>
        <div className="cg-topbar-right">
          <span className={`cg-conn-chip ${status?.minds ? "connected" : ""}`}>
            <i />
            {status?.minds ? "Minds connected" : "Minds not configured"}
          </span>
          {clerkEnabled && (
            <AuthArea
              onAuthChange={() => {
                setSelectedId(null);
                void refresh();
              }}
            />
          )}
        </div>
      </header>

      <main className="cg-main">
        {error && (
          <div className="cg-alert">
            <span><Icon name="alert-triangle" size={15} /></span>
            <div>
              <strong>Something went wrong</strong>
              <p>{error}</p>
            </div>
            <button onClick={() => { setError(null); void refresh(); }}>Dismiss</button>
          </div>
        )}

        {!connections.onboardingDone && !loading ? (
          <ConnectWizard
            connections={connections}
            status={status}
            onFinish={async (skip: boolean) => {
              setConnections((current) => ({
                ...current,
                onboardingDone: true,
              }));
              await fetch("/api/connections", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ onboardingDone: true }),
              });
              void refresh();
              setToast(
                skip
                  ? {
                      title: "You can connect channels anytime",
                      copy: "Open Settings → Connections to finish setup.",
                    }
                  : {
                      title: "Channels connected",
                      copy: "Your dashboard now shows only your connected channels.",
                    },
              );
            }}
            onDetected={(detected) =>
              setConnections((current) => ({ ...current, platforms: detected }))
            }
          />
        ) : (
          <>
            {view === "overview" && (
              <Overview
                incidents={visibleIncidents}
                needsReview={needsReview}
                monitoring={monitoring}
                quarantined={quarantined}
                resolved={resolved}
                loading={loading}
                noChannels={noChannelsConnected}
                onConnect={reopenWizard}
                onCompose={() => setComposerOpen(true)}
                onSelect={setSelectedId}
                onViewAll={() => setView("incidents")}
              />
            )}

            {view === "incidents" && (
              <IncidentsView
                incidents={visibleIncidents}
                loading={loading}
                noChannels={noChannelsConnected}
                onConnect={reopenWizard}
                onSelect={setSelectedId}
                onCompose={() => setComposerOpen(true)}
                onRefresh={refresh}
              />
            )}
          </>
        )}

        {view === "policy" && (
          <PolicyView
            draft={policyDraft}
            setDraft={setPolicyDraft}
            saving={policySaving}
            onSave={savePolicyNow}
            updatedAt={policy?.updatedAt ?? ""}
            proposals={proposals}
            proposalBusy={proposalBusy}
            onAskMind={askMindForProposal}
            onDecideProposal={decideProposal}
          />
        )}

        {view === "settings" && (
          <SettingsView
            status={status}
            onRefresh={refresh}
            onManageConnections={reopenWizard}
          />
        )}
      </main>

      {composerOpen && (
        <div className="cg-overlay" onClick={() => setComposerOpen(false)}>
          <div className="cg-composer" onClick={(event) => event.stopPropagation()}>
            <div className="cg-composer-head">
              <div>
                <div className="cg-eyebrow">NEW INCIDENT</div>
                <h2>Review a message</h2>
              </div>
              <button className="cg-close" onClick={() => setComposerOpen(false)}>
                <Icon name="x" size={16} />
              </button>
            </div>
            <label className="cg-field">
              <span>Message</span>
              <textarea
                autoFocus
                placeholder="Paste the message that needs a safety decision…"
                value={composer.message}
                onChange={(event) => setComposer({ ...composer, message: event.target.value })}
              />
            </label>
            <div className="cg-field-row">
              <label className="cg-field">
                <span>Author handle</span>
                <input
                  placeholder="@handle (optional)"
                  value={composer.authorId}
                  onChange={(event) => setComposer({ ...composer, authorId: event.target.value })}
                />
              </label>
              <label className="cg-field">
                <span>Platform</span>
                <select
                  value={composer.platform}
                  onChange={(event) => setComposer({ ...composer, platform: event.target.value })}
                >
                  <option value="manual">Manual review</option>
                  <option value="discord">Discord</option>
                  <option value="telegram">Telegram</option>
                  <option value="youtube">YouTube</option>
                </select>
              </label>
            </div>
            {status && !status.featherless && (
              <div className="cg-composer-note">
                Automated analysis is not configured. CreaGuard will store the case for manual review without fabricating a classification.
              </div>
            )}
            <div className="cg-composer-actions">
              <button className="cg-btn ghost" onClick={() => setComposerOpen(false)}>Cancel</button>
              <button
                className="cg-btn primary"
                disabled={!composer.message.trim() || submitting}
                onClick={submitIncident}
              >
                {submitting ? "Analyzing…" : "Create case"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="cg-overlay" onClick={() => setSelectedId(null)}>
          <div className="cg-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="cg-drawer-head">
              <div>
                <div className="cg-eyebrow">{selected.externalId}</div>
                <h2>{categoryLabels[selected.category]}</h2>
              </div>
              <button className="cg-close" onClick={() => setSelectedId(null)}>
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="cg-drawer-body">
              <div className={`cg-risk-banner tone-${categoryTone[selected.category]}`}>
                <span><Icon name={categoryIcon[selected.category]} size={15} /></span>
                <div>
                  <strong>
                    {selected.status === "needs_review"
                      ? "Needs your decision"
                      : selected.status === "monitoring"
                        ? "Monitoring"
                        : selected.status === "quarantined"
                          ? "Auto-quarantined"
                          : selected.status === "resolved"
                            ? "Resolved"
                            : "Dismissed"}
                  </strong>
                  <p>
                    Risk score {selected.riskScore}/100 · severity {selected.severity}/5 ·{" "}
                    {selected.events.at(-1)?.classification?.confidence
                      ? `${Math.round((selected.events.at(-1)?.classification?.confidence ?? 0) * 100)}% confidence`
                      : "manual case"}
                    {selected.status === "quarantined" &&
                      " · obvious scam, auto-handled — you can still review or restore it"}
                  </p>
                </div>
              </div>

              <div className="cg-drawer-section">Messages</div>
              {selected.events.map((event) => (
                <div className="cg-message" key={event.id}>
                  <div className="cg-message-meta">
                    <b>{event.authorId || "Unknown author"}</b>
                    <span>{event.platform} · {relativeTime(event.createdAt)}</span>
                  </div>
                  <p>{event.message}</p>
                </div>
              ))}

              {suspectIncidents.length > 1 && (
                <div className="cg-suspect-card">
                  <div className="cg-suspect-head">
                    <span className="cg-suspect-icon"><Icon name="users" size={14} /></span>
                    <div>
                      <strong>Repeat offender — {suspectIncidents[0].events.at(-1)?.authorId || "unknown"}</strong>
                      <p>
                        {suspectIncidents.length} incidents across {suspectPlatforms.length} platform{suspectPlatforms.length === 1 ? "" : "s"}
                        {suspectPlatforms.length > 1 ? " — your Mind sees this person across channels." : " — same person, same channel."}
                      </p>
                    </div>
                  </div>
                  <div className="cg-suspect-list">
                    {suspectIncidents.map((item) => (
                      <button
                        key={item.id}
                        className={`cg-suspect-row ${item.id === selected.id ? "current" : ""}`}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <span className={`cg-tag tone-${categoryTone[item.category]}`}>
                          {categoryLabels[item.category]}
                        </span>
                        <span>{item.events.at(-1)?.platform}</span>
                        <span className="cg-muted">{item.externalId}</span>
                        <span className="cg-score-pill">{item.riskScore}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="cg-drawer-section">Analysis</div>
              <div className="cg-analysis">
                <div className="cg-analysis-row">
                  <span>Category</span>
                  <b>{categoryLabels[selected.category]}</b>
                </div>
                <div className="cg-analysis-row">
                  <span>Summary</span>
                  <p>{selected.events.at(-1)?.classification?.summary ?? "Awaiting analysis."}</p>
                </div>
                <div className="cg-analysis-row">
                  <span>Recommendation</span>
                  <p>{selected.events.at(-1)?.classification?.recommendedAction ?? "Manual review."}</p>
                </div>
              </div>

              {selected.decisionNote && (
                <>
                  <div className="cg-drawer-section">Decision note</div>
                  <p className="cg-decision-note">{selected.decisionNote}</p>
                </>
              )}

              <div className="cg-drawer-section">Your decision</div>
              <label className="cg-field cg-drawer-note">
                <span>Decision note — teach your Mind</span>
                <textarea
                  rows={2}
                  placeholder="e.g. Confirmed ban: this account impersonates creators to run scams…"
                  value={decisionNote}
                  onChange={(event) => setDecisionNote(event.target.value)}
                />
              </label>
              <p className="cg-drawer-note-hint">
                When you resolve or dismiss with a note, your Mind learns your
                standard for similar cases — no extra setup needed.
              </p>

              <div className="cg-drawer-section">Enforcement</div>
              {enforceEnabled ? (
                <div className="cg-enforce-actions">
                  <button
                    className="cg-btn danger"
                    onClick={() => enforceIncident("ban")}
                  >
                    <Icon name="user-x" size={14} /> Ban user
                  </button>
                  <button
                    className="cg-btn ghost"
                    onClick={() => enforceIncident("delete")}
                  >
                    <Icon name="x" size={14} /> Remove message
                  </button>
                </div>
              ) : (
                <p className="cg-drawer-note-hint">
                  {selectedPlatform === "youtube"
                    ? "YouTube has no moderation API — CreaGuard recommends; take the action manually on YouTube."
                    : "No automated enforcement channel for this case. CreaGuard recommends; you act on the platform."}
                </p>
              )}

              <div className="cg-drawer-section">Mind review</div>
              <div className={`cg-minds-review ${shownMindsReply ? "reply" : mindsState}`}>
                {shownMindsReply ? (
                  <>
                    <span className="cg-minds-avatar"><Icon name="sparkles" size={14} /></span>
                    <div>
                      <strong>Your Mind replied</strong>
                      <p className="cg-minds-reply-text">{mindReplyToText(shownMindsReply)}</p>
                    </div>
                  </>
                ) : !selected.mindsAlias ? (
                  <>
                    <span><Icon name="send" size={14} /></span>
                    <div>
                      <strong>Not sent to your Mind</strong>
                      <p>Low-risk case — it stays in monitoring. Use “Relay to Minds” if you want the Mind to review it.</p>
                    </div>
                  </>
                ) : mindsState === "pending" ? (
                  <>
                    <span className="cg-minds-spinner" />
                    <div>
                      <strong>Consulting your Mind…</strong>
                      <p>The Mind is reading the case against your policy.</p>
                    </div>
                  </>
                ) : mindsState === "error" ? (
                  <>
                    <span><Icon name="alert-triangle" size={14} /></span>
                    <div>
                      <strong>Mind reply unavailable</strong>
                      <p>The case was relayed, but the reply could not be read. Check the Minds conversation for {selected.externalId}.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <span><Icon name="send" size={14} /></span>
                    <div>
                      <strong>Relayed to your Mind</strong>
                      <p>Re-open this case if the reply hasn't appeared yet.</p>
                    </div>
                  </>
                )}
              </div>

              {(() => {
                const recommendation =
                  selected.proposedAction ?? shownMindsReply ?? null;
                if (!recommendation) return null;
                const parsed = parseRecommendedAction(recommendation);
                if (!parsed.action) return null;
                const label =
                  parsed.action === "ban"
                    ? "Approve: ban user"
                    : parsed.action === "timeout"
                      ? "Approve: 24h timeout"
                      : "Approve: remove message";
                return (
                  <div className="cg-proposed-card">
                    <div className="cg-proposed-head">
                      <span className="cg-minds-avatar"><Icon name="sparkles" size={13} /></span>
                      <div>
                        <strong>Your Mind recommends</strong>
                        <p className="cg-proposed-text">{mindReplyToText(recommendation)}</p>
                      </div>
                    </div>
                    {enforceEnabled ? (
                      <button
                        className="cg-btn danger cg-proposed-action"
                        onClick={() => enforceIncident(parsed.action!)}
                      >
                        <Icon name="check" size={14} /> {label}
                      </button>
                    ) : (
                      <p className="cg-drawer-note-hint">
                        Your Mind recommends “{parsed.match}” — {selectedPlatform === "youtube" ? "YouTube has no moderation API, so take this action manually." : "take this action manually on the platform."}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
            <div className="cg-drawer-actions">
              <button className="cg-btn ghost" onClick={() => updateIncident("monitoring")}>
                <Icon name="clock" size={14} /> Monitor
              </button>
              <button className="cg-btn ghost" onClick={() => updateIncident("dismissed", false, decisionNote)}>
                <Icon name="x" size={14} /> Dismiss
              </button>
              <button className="cg-btn ghost" onClick={() => updateIncident("resolved", false, decisionNote)}>
                <Icon name="check" size={14} /> Resolve
              </button>
              <button
                className="cg-btn primary"
                onClick={() => updateIncident(selected.status === "needs_review" ? "monitoring" : "resolved", true)}
              >
                <Icon name="send" size={14} /> Relay to Minds
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="cg-toast">
          <span><Icon name="check" size={13} /></span>
          <div>
            <strong>{toast.title}</strong>
            <p>{toast.copy}</p>
          </div>
        </div>
      )}
    </div>
  );
}

const CHANNEL_META: {
  key: ChannelName;
  name: string;
  icon: string;
  step: string;
  hint: string;
  configLabel: string;
  configOk: (status: SystemStatus | null) => boolean;
}[] = [
  {
    key: "telegram",
    name: "Telegram",
    icon: "send",
    step: "Send any message to your bot on Telegram — it replies with a risk verdict and connects.",
    hint: "Best to start here — takes 30 seconds.",
    configLabel: "Telegram bot",
    configOk: (status) => Boolean(status?.channels.telegram),
  },
  {
    key: "discord",
    name: "Discord",
    icon: "message-square",
    step: "Run /review <message> in your server after adding the bot to it.",
    hint: "Needs the bot invited with Ban + Manage Messages permissions.",
    configLabel: "Discord bot",
    configOk: (status) => Boolean(status?.channels.discord),
  },
  {
    key: "youtube",
    name: "YouTube",
    icon: "trending-up",
    step: "Paste a video link on the Incidents page — its comments get analyzed.",
    hint: "Import-based: paste any link to watch its comments.",
    configLabel: "YouTube API",
    configOk: (status) => Boolean(status?.channels.youtube),
  },
];

function ConnectWizard(props: {
  connections: Connections;
  status: SystemStatus | null;
  onFinish: (skip: boolean) => void;
  onDetected: (platforms: ChannelName[]) => void;
}) {
  const [stage, setStage] = useState<"intro" | "channels">("intro");
  const [active, setActive] = useState<ChannelName | null>(null);
  const [links, setLinks] = useState<Record<string, string | null>>({});
  const connected = new Set(props.connections.platforms);
  const allConnected = CHANNEL_META.every((channel) => connected.has(channel.key));
  const anyConnected = connected.size > 0;

  // Load the deep links (Telegram bot chat, Discord invite, YouTube) once,
  // so clicking a channel can jump straight to the real app.
  useEffect(() => {
    void fetch("/api/connect/links", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { links?: Record<string, string | null> } | null) => {
        if (data?.links) setLinks(data.links);
      })
      .catch(() => undefined);
  }, []);

  function pickChannel(key: ChannelName) {
    if (connected.has(key)) return;
    setActive(key);
    const url = links[key];
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  // On open, record when the wizard started so only channels that deliver a
  // NEW case (after this moment) count as connected. Then poll continuously
  // while the wizard is open (never times out), so the moment a channel's
  // first case arrives its card flips to "Connected".
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/connections", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wizardStartedAt: new Date().toISOString() }),
    }).catch(() => undefined);

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch("/api/connections", { cache: "no-store" });
        const data = (await res.json()) as { connections?: Connections };
        if (data.connections && !cancelled) {
          props.onDetected(data.connections.platforms);
        }
      } catch {
        /* transient */
      }
    }
    void poll();
    const interval = setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  return (
    <div className="cg-page cg-connect">
      {stage === "intro" ? (
        <>
          <section className="cg-connect-head">
            <div className="cg-eyebrow">SETUP IN 2 MINUTES</div>
            <h1>Connect your channels</h1>
            <p>
              CreaGuard watches the places your community talks to you — up to 3:
              Telegram, Discord, and YouTube. Connect one or all; your dashboard
              shows only the channels you've connected.
            </p>
            <div className="cg-connect-count">
              {connected.size}/3 connected
            </div>
          </section>
          <div className="cg-connect-actions cg-connect-actions-center">
            <button className="cg-btn ghost" onClick={() => props.onFinish(true)}>
              Skip for now
            </button>
            <button
              className="cg-btn primary cg-connect-cta"
              onClick={() => setStage("channels")}
            >
              Connect now
            </button>
          </div>
        </>
      ) : (
        <>
          <section className="cg-connect-head">
            <div className="cg-eyebrow">CHOOSE A CHANNEL</div>
            <h1>Pick where to connect first</h1>
            <p>
              Tap a channel, complete its step — CreaGuard detects it live and
              marks it connected. You can add the rest anytime.
            </p>
            <div className="cg-connect-count">
              {connected.size}/3 connected
            </div>
          </section>

          <div className="cg-connect-grid">
            {CHANNEL_META.map((channel) => {
              const isConnected = connected.has(channel.key);
              const configured = channel.configOk(props.status);
              const isActive = active === channel.key;
              return (
                <button
                  key={channel.key}
                  className={`cg-connect-card ${isConnected ? "connected" : ""} ${isActive ? "active" : ""}`}
                  onClick={() => pickChannel(channel.key)}
                >
                  <div className="cg-connect-card-head">
                    <span className="cg-connect-icon">
                      <Icon name={channel.icon} size={16} />
                    </span>
                    <div>
                      <strong>{channel.name}</strong>
                      <p>{channel.hint}</p>
                    </div>
                    <span className={`cg-connect-status ${isConnected ? "ok" : ""}`}>
                      {isConnected ? "✓ Connected" : "Connect"}
                    </span>
                  </div>
                  <p className="cg-connect-step">{channel.step}</p>
                  {isActive && !isConnected && (
                    <div className="cg-connect-waiting">
                      <span className="cg-minds-spinner" />
                      <div>
                        <strong>
                          {links[channel.key]
                            ? `${channel.name} opened in a new tab — complete the step there`
                            : `Now open ${channel.name} and do the step above`}
                        </strong>
                        <p>This screen is watching — the moment your message
                        arrives, this card flips to Connected automatically.</p>
                        {links[channel.key] && (
                          <button
                            className="cg-link"
                            onClick={(event) => {
                              event.stopPropagation();
                              window.open(links[channel.key]!, "_blank", "noopener,noreferrer");
                            }}
                          >
                            Open {channel.name} again
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {!configured && !isConnected && (
                    <p className="cg-connect-config-note">
                      ⚠️ {channel.configLabel} isn't configured on the server
                      yet — add its API key, then refresh this page.
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          <div className="cg-connect-actions">
            <button className="cg-btn ghost" onClick={() => setStage("intro")}>
              Back
            </button>
            <button
              className="cg-btn primary"
              disabled={!anyConnected}
              onClick={() => props.onFinish(false)}
            >
              {anyConnected ? "Finish — you're protected" : "Connect at least one channel first"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Overview(props: {
  incidents: Incident[];
  needsReview: number;
  monitoring: number;
  quarantined: number;
  resolved: number;
  loading: boolean;
  noChannels: boolean;
  onConnect: () => void;
  onCompose: () => void;
  onSelect: (id: string) => void;
  onViewAll: () => void;
}) {
  return (
    <div className="cg-page">
      <section className="cg-hero">
        <div>
          <div className="cg-eyebrow">CREATOR SAFETY</div>
          <h1>Protect your space,<br />with context.</h1>
          <p>
            CreaGuard connects threats, doxxing, impersonation, scams, and
            repeated harassment across time — so no safety decision starts from zero.
          </p>
          <button className="cg-btn primary" onClick={props.onCompose}>
            Review a message
          </button>
        </div>
        <div className="cg-hero-visual">
          <div className="cg-orbit">
            <div className="cg-orbit-ring" />
            <div className="cg-orbit-core">
              <Icon name="shield" size={26} />
            </div>
            <span className="cg-orbit-tag tag-1">Threat</span>
            <span className="cg-orbit-tag tag-2">Doxxing</span>
            <span className="cg-orbit-tag tag-3">Scam</span>
          </div>
        </div>
      </section>

      {props.incidents.length === 0 && !props.loading && (
        <section className="cg-onboard">
          <div className="cg-onboard-head">
            <div className="cg-eyebrow">GET STARTED</div>
            <h2>{props.noChannels ? "Connect your channels first" : "Protect your space in three steps"}</h2>
          </div>
          {props.noChannels ? (
            <div className="cg-onboard-steps">
              <div className="cg-onboard-step">
                <span>1</span>
                <div>
                  <strong>Connect Telegram, Discord, or YouTube</strong>
                  <p>Your dashboard is empty until at least one channel is connected — that's on purpose.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="cg-onboard-steps">
              <div className="cg-onboard-step">
                <span>1</span>
                <div>
                  <strong>Paste a message</strong>
                  <p>Review one message now to see the whole flow.</p>
                </div>
              </div>
              <div className="cg-onboard-step">
                <span>2</span>
                <div>
                  <strong>Watch it get analyzed</strong>
                  <p>Risk score and category in seconds — no keyword filters.</p>
                </div>
              </div>
              <div className="cg-onboard-step">
                <span>3</span>
                <div>
                  <strong>Your Mind reviews, you approve</strong>
                  <p>The Mind drafts the call; you make the decision.</p>
                </div>
              </div>
            </div>
          )}
          <button
            className="cg-btn primary"
            onClick={props.noChannels ? props.onConnect : props.onCompose}
          >
            {props.noChannels ? "Connect now" : "Review your first message"}
          </button>
        </section>
      )}

      <section className="cg-stats">
        <StatCard label="Open incidents" value={props.incidents.filter((i) => i.status !== "resolved" && i.status !== "dismissed").length} icon="inbox" tone="violet" />
        <StatCard label="Needs review" value={props.needsReview} icon="alert-triangle" tone="amber" />
        <StatCard label="Monitoring" value={props.monitoring} icon="clock" tone="blue" />
        <StatCard label="Quarantined" value={props.quarantined} icon="eye-off" tone="quarantine" />
        <StatCard label="Resolved" value={props.resolved} icon="check-circle" tone="green" />
      </section>

      <section className="cg-split">
        <div className="cg-panel">
          <div className="cg-panel-head">
            <div>
              <h2>Recent cases</h2>
              <p>Newest safety decisions in this workspace</p>
            </div>
            <button className="cg-link" onClick={props.onViewAll}>
              View all <Icon name="arrow-right" size={13} />
            </button>
          </div>
          {props.loading ? (
            <div className="cg-empty">Loading cases…</div>
          ) : props.incidents.length === 0 ? (
            <div className="cg-empty">
              <div className="cg-empty-icon"><Icon name="shield" size={26} /></div>
              <strong>No cases yet</strong>
              <p>Review your first message to start the safety log.</p>
              <button className="cg-btn primary" onClick={props.onCompose}>Review a message</button>
            </div>
          ) : (
            <div className="cg-case-list">
              {props.incidents.slice(0, 5).map((incident) => (
                <button className="cg-case-row" key={incident.id} onClick={() => props.onSelect(incident.id)}>
                  <span className={`cg-case-mark tone-${categoryTone[incident.category]}`}>
                    <Icon name={categoryIcon[incident.category]} size={15} />
                  </span>
                  <div className="cg-case-main">
                    <div className="cg-case-title">
                      <strong>{categoryLabels[incident.category]}</strong>
                      <span className={`cg-tag tone-${categoryTone[incident.category]}`}>{incident.status.replace("_", " ")}</span>
                    </div>
                    <p>{incident.events.at(-1)?.message}</p>
                    <span className="cg-case-meta">
                      {incident.externalId} · {incident.events.length} event{incident.events.length === 1 ? "" : "s"} · {relativeTime(incident.updatedAt)}
                    </span>
                  </div>
                  <span className="cg-case-score">{incident.riskScore}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="cg-panel">
          <div className="cg-panel-head">
            <div>
              <h2>Safety posture</h2>
              <p>Current protection signals</p>
            </div>
          </div>
          <div className="cg-posture">
            <div className="cg-posture-row">
              <span>Policy active</span>
              <b className="ok">On</b>
            </div>
            <div className="cg-posture-row">
              <span>Human approval for bans</span>
              <b className="ok">Enforced</b>
            </div>
            <div className="cg-posture-row">
              <span>Evidence preservation</span>
              <b className="ok">Enabled</b>
            </div>
            <div className="cg-posture-row">
              <span>Follow-up window</span>
              <b>24h–72h</b>
            </div>
          </div>
          <div className="cg-principle">
            <span><Icon name="shield" size={16} /></span>
            <p>
              CreaGuard recommends. You decide. Dangerous actions are never taken automatically.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard(props: { label: string; value: number; icon: string; tone: string }) {
  return (
    <div className="cg-stat">
      <div className="cg-stat-head">
        <span>{props.label}</span>
        <span className={`cg-stat-icon tone-${props.tone}`}>
          <Icon name={props.icon} size={14} />
        </span>
      </div>
      <div className="cg-stat-value">{props.value}</div>
    </div>
  );
}

function IncidentsView(props: {
  incidents: Incident[];
  loading: boolean;
  noChannels: boolean;
  onConnect: () => void;
  onSelect: (id: string) => void;
  onCompose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [filter, setFilter] = useState<string>("all");
  const [videoUrl, setVideoUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const filtered = props.incidents.filter((item) => filter === "all" || item.status === filter);

  async function importVideo() {
    if (!videoUrl.trim() || importing) return;
    setImporting(true);
    setImportMessage(null);
    try {
      const res = await fetch("/api/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: videoUrl.trim() }),
      });
      const data = (await res.json()) as {
        error?: string;
        analyzed?: number;
        remaining?: number;
        total?: number;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to import comments.");
      await props.onRefresh();
      const remaining = data.remaining ?? 0;
      setImportMessage(
        `Analyzed ${data.analyzed ?? 0} of ${data.total ?? 0} comments${remaining > 0 ? ` — ${remaining} still queued, run the import again to continue.` : "."}`,
      );
      setVideoUrl("");
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : "Failed to import comments.");
    } finally {
      setImporting(false);
    }
  }
  return (
    <div className="cg-page">
      <section className="cg-page-head">
        <div>
          <div className="cg-eyebrow">CASE MANAGEMENT</div>
          <h1>Incidents</h1>
          <p>Every case, with the context CreaGuard remembers.</p>
        </div>
        <button className="cg-btn primary" onClick={props.onCompose}>Review a message</button>
      </section>

      <div className="cg-import">
        <div className="cg-import-main">
          <strong>Import YouTube comments</strong>
          <p>Paste a video link — its comments run through the same analysis pipeline.</p>
        </div>
        <input
          placeholder="https://youtube.com/watch?v=…"
          value={videoUrl}
          onChange={(event) => setVideoUrl(event.target.value)}
        />
        <button
          className="cg-btn primary"
          disabled={!videoUrl.trim() || importing}
          onClick={importVideo}
        >
          {importing ? "Importing…" : "Import"}
        </button>
      </div>
      {importMessage && <p className="cg-import-result">{importMessage}</p>}

      <div className="cg-filters">
        {[
          { key: "all", label: "All" },
          { key: "needs_review", label: "Needs review" },
          { key: "monitoring", label: "Monitoring" },
          { key: "quarantined", label: "Quarantined" },
          { key: "resolved", label: "Resolved" },
          { key: "dismissed", label: "Dismissed" },
        ].map((item) => (
          <button
            key={item.key}
            className={`cg-filter ${filter === item.key ? "active" : ""}`}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="cg-panel cg-table-panel">
        {props.loading ? (
          <div className="cg-empty">Loading cases…</div>
        ) : props.noChannels ? (
          <div className="cg-empty">
            <strong>No channels connected yet</strong>
            <p>Connect Telegram, Discord, or YouTube — cases from connected channels appear here.</p>
            <button className="cg-btn primary" onClick={props.onConnect}>Connect now</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="cg-empty">
            <strong>No cases in this view</strong>
            <p>Try another filter or review a new message.</p>
          </div>
        ) : (
          <div className="cg-table">
            <div className="cg-table-head">
              <span>Incident</span>
              <span>Risk</span>
              <span>Category</span>
              <span>Status</span>
              <span>Updated</span>
            </div>
            {filtered.map((incident) => (
              <button className="cg-table-row" key={incident.id} onClick={() => props.onSelect(incident.id)}>
                <span className="cg-table-primary">
                  <strong>{incident.externalId}</strong>
                  <small>{incident.events.at(-1)?.message.slice(0, 60)}</small>
                </span>
                <span className="cg-score-pill">{incident.riskScore}</span>
                <span>{categoryLabels[incident.category]}</span>
                <span className={`cg-tag tone-${incident.status === "needs_review" ? "critical" : incident.status === "resolved" ? "safe" : incident.status === "quarantined" ? "quarantine" : "neutral"}`}>
                  {incident.status.replace("_", " ")}
                </span>
                <span className="cg-muted">{relativeTime(incident.updatedAt)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PolicyView(props: {
  draft: string;
  setDraft: (value: string) => void;
  saving: boolean;
  onSave: () => void;
  updatedAt: string;
  proposals: PolicyProposal[];
  proposalBusy: boolean;
  onAskMind: () => void;
  onDecideProposal: (id: string, approve: boolean) => void;
}) {
  const pending = props.proposals.filter((proposal) => proposal.status === "pending");
  const history = props.proposals.filter((proposal) => proposal.status !== "pending");
  return (
    <div className="cg-page">
      <section className="cg-page-head">
        <div>
          <div className="cg-eyebrow">MEMORY & BOUNDARIES</div>
          <h1>Safety policy</h1>
          <p>Teach CreaGuard what protection means to you.</p>
        </div>
        <button className="cg-btn primary" onClick={props.onSave} disabled={props.saving}>
          {props.saving ? "Saving…" : "Save policy"}
        </button>
      </section>

      {pending.length > 0 && (
        <div className="cg-panel cg-proposals">
          <div className="cg-panel-head">
            <div>
              <h2>Your Mind proposes a policy change</h2>
              <p>It learned from your decisions — approve to make it active, or reject to keep the current policy.</p>
            </div>
          </div>
          {pending.map((proposal) => (
            <div className="cg-proposal" key={proposal.id}>
              <p className="cg-proposal-content">{proposal.content}</p>
              <div className="cg-proposal-actions">
                <span className="cg-muted">Proposed {relativeTime(proposal.createdAt)}</span>
                <button
                  className="cg-btn danger"
                  onClick={() => props.onDecideProposal(proposal.id, false)}
                >
                  Reject
                </button>
                <button
                  className="cg-btn primary"
                  onClick={() => props.onDecideProposal(proposal.id, true)}
                >
                  <Icon name="check" size={14} /> Approve & apply
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="cg-split cg-policy-split">
        <div className="cg-panel">
          <div className="cg-editor-label">
            <span>CREATOR SAFETY POLICY</span>
            {props.updatedAt && <span className="cg-muted">Updated {relativeTime(props.updatedAt)}</span>}
          </div>
          <textarea
            className="cg-policy-editor"
            value={props.draft}
            onChange={(event) => props.setDraft(event.target.value)}
          />
          <p className="cg-editor-note">
            This policy is stored in the workspace and used to guide review decisions.
            It never authorizes automatic bans or reports.
          </p>
        </div>

        <div className="cg-panel">
          <div className="cg-panel-head">
            <div>
              <h2>Standing boundaries</h2>
              <p>Recommended defaults</p>
            </div>
          </div>
          <div className="cg-boundaries">
            <div><span><Icon name="message-square" size={13} /></span><div><strong>Criticism is allowed</strong><small>Do not treat disagreement as abuse</small></div></div>
            <div><span><Icon name="alert-triangle" size={13} /></span><div><strong>Human approval for bans</strong><small>Serious actions stay under your control</small></div></div>
            <div><span><Icon name="sparkles" size={13} /></span><div><strong>Calm response tone</strong><small>Drafts avoid escalation</small></div></div>
            <div><span><Icon name="trending-up" size={13} /></span><div><strong>Escalate repeat targeting</strong><small>Connected events trigger review</small></div></div>
          </div>
          <div className="cg-policy-mind-block">
            <div className="cg-panel-head">
              <div>
                <h2>Policy evolution</h2>
                <p>Let your Mind propose updates from your decisions</p>
              </div>
            </div>
            <button
              className="cg-btn ghost"
              onClick={props.onAskMind}
              disabled={props.proposalBusy || pending.length > 0}
            >
              <Icon name="sparkles" size={14} />
              {props.proposalBusy
                ? "Asking your Mind…"
                : pending.length > 0
                  ? "Proposal awaiting your review"
                  : "Ask your Mind to propose an update"}
            </button>
          </div>
          {history.length > 0 && (
            <div className="cg-proposal-history">
              <div className="cg-panel-head">
                <div>
                  <h2>Proposal history</h2>
                </div>
              </div>
              {history.slice(0, 4).map((proposal) => (
                <div className="cg-proposal-history-row" key={proposal.id}>
                  <span className={`cg-tag tone-${proposal.status === "accepted" ? "safe" : "neutral"}`}>
                    {proposal.status}
                  </span>
                  <p>{proposal.summary}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsView(props: {
  status: SystemStatus | null;
  onRefresh: () => void;
  onManageConnections: () => void;
}) {
  const rows = [
    {
      label: "Upstash Redis",
      detail: props.status ? (props.status.storage === "redis" ? "Connected" : `Using ${props.status.storage} store`) : "Checking…",
      ok: props.status?.storage === "redis",
      hint: "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for durable storage.",
    },
    {
      label: "Featherless analysis",
      detail: props.status?.featherless ? "Connected" : "Not configured",
      ok: Boolean(props.status?.featherless),
      hint: "Set FEATHERLESS_API_KEY to enable real risk classification.",
    },
    {
      label: "Minds agent",
      detail: props.status?.minds ? "Connected" : "Not configured",
      ok: Boolean(props.status?.minds),
      hint: "Set MINDS_BUILDER_API_KEY and MINDS_MIND_ID to relay cases to your Mind.",
    },
    {
      label: "Telegram bot",
      detail: props.status?.channels.telegram ? "Connected" : "Not configured",
      ok: Boolean(props.status?.channels.telegram),
      hint: "Set TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_SECRET, then run scripts/setup-telegram.mjs.",
    },
    {
      label: "YouTube import",
      detail: props.status?.channels.youtube ? "Connected" : "Not configured",
      ok: Boolean(props.status?.channels.youtube),
      hint: "Set YOUTUBE_API_KEY, then paste a video link on the Incidents page.",
    },
    {
      label: "Scheduled follow-up",
      detail: "Daily 09:00 UTC",
      ok: true,
      hint: "The Mind re-reviews open cases and proposes the next step automatically.",
    },
    {
      label: "Morning digest",
      detail: "Daily 08:00 UTC",
      ok: true,
      hint: "A Telegram summary of new cases, repeat offenders, and pending decisions.",
    },
  ];

  return (
    <div className="cg-page">
      <section className="cg-page-head">
        <div>
          <div className="cg-eyebrow">WORKSPACE SETTINGS</div>
          <h1>Connections</h1>
          <p>Connect the real services that power CreaGuard.</p>
        </div>
        <button className="cg-btn ghost" onClick={props.onManageConnections}>
          <Icon name="send" size={14} /> Manage connections
        </button>
        <button className="cg-btn ghost" onClick={props.onRefresh}>Refresh</button>
      </section>

      <div className="cg-panel cg-connections">
        {rows.map((row) => (
          <div className="cg-connection" key={row.label}>
            <span className={`cg-conn-dot ${row.ok ? "ok" : ""}`} />
            <div className="cg-connection-main">
              <strong>{row.label}</strong>
              <p>{row.detail}</p>
            </div>
            <div className="cg-connection-hint">{row.hint}</div>
          </div>
        ))}
      </div>

      <div className="cg-panel cg-security">
        <div className="cg-panel-head">
          <div>
            <h2>Security posture</h2>
            <p>Hard limits enforced by the product</p>
          </div>
        </div>
        <div className="cg-posture">
          <div className="cg-posture-row"><span>Automatic bans</span><b className="bad">Blocked</b></div>
          <div className="cg-posture-row"><span>Automatic reporting</span><b className="bad">Blocked</b></div>
          <div className="cg-posture-row"><span>Evidence deletion</span><b className="bad">Blocked</b></div>
          <div className="cg-posture-row"><span>API key exposure</span><b className="ok">Server-side only</b></div>
        </div>
      </div>
    </div>
  );
}
