"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Incident,
  Policy,
  RiskCategory,
  SystemStatus,
} from "@/lib/types";
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

export function CreaGuardApp() {
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

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [incidentsRes, policyRes, statusRes] = await Promise.all([
        fetch("/api/incidents", { cache: "no-store" }),
        fetch("/api/policy", { cache: "no-store" }),
        fetch("/api/health", { cache: "no-store" }),
      ]);
      if (!incidentsRes.ok || !policyRes.ok || !statusRes.ok) {
        throw new Error("Failed to load workspace data.");
      }
      const incidentsData = (await incidentsRes.json()) as { incidents: Incident[] };
      const policyData = (await policyRes.json()) as { policy: Policy };
      const statusData = (await statusRes.json()) as { status: SystemStatus };
      setIncidents(incidentsData.incidents);
      setPolicy(policyData.policy);
      setPolicyDraft(policyData.policy.content);
      setStatus(statusData.status);
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

  useEffect(() => {
    if (!selectedId) {
      setMindsReply(null);
      setMindsState("idle");
      return;
    }
    let cancelled = false;
    async function loadMindsReply() {
      setMindsState("pending");
      for (let attempt = 0; attempt < 6; attempt += 1) {
        if (cancelled) return;
        try {
          const res = await fetch(`/api/incidents/${selectedId}`, { cache: "no-store" });
          if (!res.ok) throw new Error("Failed to load case.");
          const data = (await res.json()) as {
            incident?: Incident;
            minds?: { connected?: boolean; reply?: string; error?: string };
          };
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
  }, [selectedId]);

  const needsReview = incidents.filter((item) => item.status === "needs_review").length;
  const monitoring = incidents.filter((item) => item.status === "monitoring").length;
  const resolved = incidents.filter((item) => item.status === "resolved").length;

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

  async function updateIncident(nextStatus: string, relayToMinds = false) {
    if (!selected) return;
    try {
      const res = await fetch(`/api/incidents/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, relayToMinds }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to update case.");
      }
      await refresh();
      setMindsReply(null);
      setMindsState("pending");
      setToast({
        title: "Case updated",
        copy: `${selected.externalId} is now ${nextStatus.replace("_", " ")}.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update case.");
    }
  }

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

        {view === "overview" && (
          <Overview
            incidents={incidents}
            needsReview={needsReview}
            monitoring={monitoring}
            resolved={resolved}
            loading={loading}
            onCompose={() => setComposerOpen(true)}
            onSelect={setSelectedId}
            onViewAll={() => setView("incidents")}
          />
        )}

        {view === "incidents" && (
          <IncidentsView
            incidents={incidents}
            loading={loading}
            onSelect={setSelectedId}
            onCompose={() => setComposerOpen(true)}
          />
        )}

        {view === "policy" && (
          <PolicyView
            draft={policyDraft}
            setDraft={setPolicyDraft}
            saving={policySaving}
            onSave={savePolicyNow}
            updatedAt={policy?.updatedAt ?? ""}
          />
        )}

        {view === "settings" && (
          <SettingsView status={status} onRefresh={refresh} />
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
                  <option value="instagram">Instagram</option>
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
                        : selected.status === "resolved"
                          ? "Resolved"
                          : "Dismissed"}
                  </strong>
                  <p>
                    Risk score {selected.riskScore}/100 · severity {selected.severity}/5 ·{" "}
                    {selected.events.at(-1)?.classification?.confidence
                      ? `${Math.round((selected.events.at(-1)?.classification?.confidence ?? 0) * 100)}% confidence`
                      : "manual case"}
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

              <div className="cg-drawer-section">Mind review</div>
              <div className={`cg-minds-review ${mindsState}`}>
                {mindsState === "pending" && (
                  <>
                    <span className="cg-minds-spinner" />
                    <div>
                      <strong>Consulting your Mind…</strong>
                      <p>The Mind is reading the case against your policy.</p>
                    </div>
                  </>
                )}
                {mindsState === "reply" && mindsReply && (
                  <>
                    <span className="cg-minds-avatar"><Icon name="sparkles" size={14} /></span>
                    <div>
                      <strong>Your Mind replied</strong>
                      <p className="cg-minds-reply-text">{mindsReply}</p>
                    </div>
                  </>
                )}
                {mindsState === "error" && (
                  <>
                    <span><Icon name="alert-triangle" size={14} /></span>
                    <div>
                      <strong>Mind reply unavailable</strong>
                      <p>The case was relayed, but the reply could not be read. Check the Minds conversation for {selected.externalId}.</p>
                    </div>
                  </>
                )}
                {mindsState === "idle" && !selected.mindsAlias && (
                  <>
                    <span><Icon name="send" size={14} /></span>
                    <div>
                      <strong>Not relayed yet</strong>
                      <p>Use “Relay to Minds” to send this case to your Mind for review.</p>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="cg-drawer-actions">
              <button className="cg-btn ghost" onClick={() => updateIncident("monitoring")}>
                <Icon name="clock" size={14} /> Monitor
              </button>
              <button className="cg-btn ghost" onClick={() => updateIncident("resolved")}>
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

function Overview(props: {
  incidents: Incident[];
  needsReview: number;
  monitoring: number;
  resolved: number;
  loading: boolean;
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

      <section className="cg-stats">
        <StatCard label="Open incidents" value={props.incidents.filter((i) => i.status !== "resolved" && i.status !== "dismissed").length} icon="inbox" tone="violet" />
        <StatCard label="Needs review" value={props.needsReview} icon="alert-triangle" tone="amber" />
        <StatCard label="Monitoring" value={props.monitoring} icon="clock" tone="blue" />
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
  onSelect: (id: string) => void;
  onCompose: () => void;
}) {
  const [filter, setFilter] = useState<string>("all");
  const filtered = props.incidents.filter((item) => filter === "all" || item.status === filter);
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

      <div className="cg-filters">
        {[
          { key: "all", label: "All" },
          { key: "needs_review", label: "Needs review" },
          { key: "monitoring", label: "Monitoring" },
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
                <span className={`cg-tag tone-${incident.status === "needs_review" ? "critical" : incident.status === "resolved" ? "safe" : "neutral"}`}>
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
}) {
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
        </div>
      </div>
    </div>
  );
}

function SettingsView(props: { status: SystemStatus | null; onRefresh: () => void }) {
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
      label: "Scheduled follow-up",
      detail: "Endpoint ready",
      ok: false,
      hint: "Point a cron job at /api/followups with the CRON_SECRET bearer token.",
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
