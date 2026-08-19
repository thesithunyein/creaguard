"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "../icons";

const FAQS = [
  {
    q: "What is CreaGuard?",
    a: "CreaGuard is a safety assistant for creators. It watches your community across Discord, Telegram, and YouTube for threats, doxxing, scams, impersonation, and repeat harassment — and remembers context across days, so no safety decision starts from zero.",
  },
  {
    q: "What problem does it solve?",
    a: "Generic moderation catches spam and bad words, but it misses context, repeat offenders, and your own boundaries. CreaGuard connects the dots between incidents over time and remembers people across platforms — a troll on Discord and YouTube is one person, not two random messages. It protects you, not just the community.",
  },
  {
    q: "How does it work?",
    a: "Four steps: 1) Sign in and connect a channel (Telegram, Discord, or YouTube). 2) CreaGuard classifies every incoming message and scores the risk. 3) Your Mind reviews each case and drafts a recommended action. 4) You approve — or not. Nothing happens without you.",
  },
  {
    q: "Do I need to connect my social accounts?",
    a: "Yes — connecting at least one channel is how it starts (you can connect up to 3: Telegram, Discord, YouTube). The wizard opens the real app for you, and the moment you message your bot or run /review, CreaGuard detects the connection live. Your dashboard stays empty until at least one channel is connected — by design, so you only ever see what you've protected.",
  },
  {
    q: "Does CreaGuard ban or report people automatically?",
    a: "Never. CreaGuard recommends, you decide. It drafts the action — ban, timeout, or remove message — and you click Approve. Banning, blocking, and reporting always require your explicit approval. This is a hard limit, not a setting.",
  },
  {
    q: "What is “the Mind”?",
    a: "The Mind is a persistent AI agent that remembers your rules and past incidents across sessions. It's why CreaGuard can connect a person's behavior from last week to today — and across platforms — instead of seeing every message in isolation. When you resolve a case, it learns your standard for next time.",
  },
  {
    q: "How does the Mind improve over time?",
    a: "Every decision you make — resolve, dismiss, ban, timeout — is sent back to the Mind as feedback. It also proposes updates to your safety policy based on your decisions; you approve or reject them. The more you use CreaGuard, the less it needs you.",
  },
  {
    q: "What happens while I'm away?",
    a: "CreaGuard keeps working: obvious scams are auto-quarantined, low-risk criticism is filed to monitoring, and a morning digest lands in your Telegram with new cases, repeat offenders, and what's waiting on you. Your Mind follows up on open cases on its own.",
  },
  {
    q: "Which platforms are supported?",
    a: "YouTube, Discord, and Telegram are live today, alongside manual review. Connect any of them and messages flow into one safety workspace — your Mind sees every case the same way, no matter where it came from.",
  },
  {
    q: "Is my data safe?",
    a: "Signing in keeps your channel connections private and per-user. In the current demo build, incidents live in a shared workspace so session-less webhooks and the dashboard stay in sync; full per-creator incident isolation (one workspace per Clerk user) is the production roadmap item. Incidents are stored durably, API keys live server-side only, evidence is never deleted automatically, and every decision keeps a full audit trail.",
  },
  {
    q: "How much does it cost?",
    a: "CreaGuard is free during the beta. A creator subscription is planned for later — but the core protection stays free to try.",
  },
];

export default function FaqPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="faq-app">
      <div className="faq-glow" />

      <header className="faq-header">
        <Link href="/" className="faq-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="CreaGuard logo" className="faq-logo" />
          <span>CreaGuard</span>
        </Link>
        <nav className="faq-nav">
          <Link href="/" className="faq-nav-link">Home</Link>
          <Link href="/app" className="faq-nav-link">Dashboard</Link>
        </nav>
        <Link href="/app" className="faq-cta">Open Dashboard</Link>
      </header>

      <main className="faq-main">
        <div className="faq-head">
          <div className="faq-eyebrow">HOW IT WORKS</div>
          <h1>Frequently asked questions</h1>
          <p>Everything you need to know about CreaGuard, in plain language.</p>
        </div>

        <div className="faq-list">
          {FAQS.map((item, index) => {
            const isOpen = open === index;
            return (
              <div className={`faq-item ${isOpen ? "open" : ""}`} key={item.q}>
                <button
                  className="faq-question"
                  onClick={() => setOpen(isOpen ? null : index)}
                  aria-expanded={isOpen}
                >
                  <span>{item.q}</span>
                  <Icon
                    name="chevron-down"
                    size={18}
                    className="faq-chevron"
                  />
                </button>
                {isOpen && <div className="faq-answer">{item.a}</div>}
              </div>
            );
          })}
        </div>

        <div className="faq-cta-band">
          <div>
            <h2>Ready to protect your space?</h2>
            <p>Review your first message in under a minute.</p>
          </div>
          <Link href="/app" className="faq-cta">Open Dashboard</Link>
        </div>
      </main>
    </div>
  );
}
