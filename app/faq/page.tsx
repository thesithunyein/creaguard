"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "../icons";

const FAQS = [
  {
    q: "What is CreaGuard?",
    a: "CreaGuard is a safety assistant for creators. It watches your community for threats, doxxing, scams, impersonation, and repeat harassment — and remembers context across days, so you never have to start from zero.",
  },
  {
    q: "What problem does it solve?",
    a: "Generic moderation catches spam and bad words, but it misses context, repeat offenders, and your own boundaries. CreaGuard connects the dots between incidents over time and protects you — not just the community.",
  },
  {
    q: "How does it work?",
    a: "Three steps: 1) Connect your community or paste a message. 2) CreaGuard classifies it and scores the risk. 3) Your Mind reviews the case, drafts a decision, and you approve. Nothing happens without you.",
  },
  {
    q: "Do I need to connect my social accounts?",
    a: "No. You can paste any message and get a full safety review immediately. Connecting Discord, Telegram, or YouTube just makes messages flow in automatically so you don't have to copy them yourself.",
  },
  {
    q: "Does CreaGuard ban or report people automatically?",
    a: "Never. CreaGuard recommends, you decide. Banning, blocking, and reporting always require your explicit approval — this is a hard limit, not a setting.",
  },
  {
    q: "What is “the Mind”?",
    a: "The Mind is a persistent AI agent that remembers your rules and past incidents across sessions. It's why CreaGuard can connect a person's behavior from last week to today, instead of seeing every message in isolation.",
  },
  {
    q: "Which platforms are supported?",
    a: "YouTube, Discord, and Telegram are live today, alongside manual review. Connect any of them and messages flow into one safety workspace — your Mind sees every case the same way, no matter where it came from.",
  },
  {
    q: "Is my data safe?",
    a: "Incidents are stored durably, API keys live server-side only, and evidence is never deleted automatically. CreaGuard keeps a full audit trail of every decision.",
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
