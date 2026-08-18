"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { BrandIcon, Icon } from "./icons";

const FULL_TEXT = "Creator Safety That Remembers Context -- Not Just Rules.";
// Split at a word boundary so the accent never breaks a word in half.
const SPLIT_AT = 40;
const LOGO_URL = "/logo.png";

interface OrbitSpec {
  size: number;
  duration: number;
  reverse: boolean;
}

interface NodeSpec {
  label: string;
  angle: number;
  radius: number;
}

const ORBITS: OrbitSpec[] = [
  { size: 353, duration: 30, reverse: true },
  { size: 501, duration: 40, reverse: false },
  { size: 649, duration: 50, reverse: false },
  { size: 797, duration: 60, reverse: true },
];

// One subtle node per safety signal, evenly spaced across the inner orbits
// (kept within the visible container so none of the labels clip).
const NODES: NodeSpec[] = [
  { label: "Threat", angle: 72, radius: 251 },
  { label: "Doxxing", angle: 144, radius: 325 },
  { label: "Scam", angle: 216, radius: 251 },
  { label: "Harassment", angle: 288, radius: 325 },
  { label: "Impersonation", angle: 0, radius: 251 },
];

const PLATFORMS = [
  { id: "youtube", label: "YouTube" },
  { id: "discord", label: "Discord" },
  { id: "telegram", label: "Telegram" },
];

function useCountUp(target: number, durationMs = 2000, startDelay = 1200) {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    let start: number | null = null;
    const timeout = setTimeout(() => {
      const tick = (now: number) => {
        if (start === null) start = now;
        const elapsed = now - start;
        const progress = Math.min(1, elapsed / durationMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(eased * target));
        if (progress < 1) raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    }, startDelay);

    return () => {
      clearTimeout(timeout);
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [target, durationMs, startDelay]);

  return value;
}

function useTypewriter(
  text: string,
  speed = 35,
  delay = 400,
): { typed: string; done: boolean } {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
    let index = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        index += 1;
        setCount(index);
        if (index >= text.length && interval) clearInterval(interval);
      }, speed);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [text, speed, delay]);

  return { typed: text.slice(0, count), done: count >= text.length };
}

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PillLink({
  href,
  children,
  variant = "left",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "left" | "right";
  className?: string;
}) {
  return (
    <span className={`ln-btn-border-wrap ${className}`}>
      <Link href={href} className={`ln-btn ln-btn-fill-${variant}`}>
        <span className="ln-btn-content">{children}</span>
      </Link>
    </span>
  );
}

function TypewriterHeading() {
  const { typed, done } = useTypewriter(FULL_TEXT, 35, 400);
  const light = typed.slice(0, SPLIT_AT);
  const accent = typed.slice(SPLIT_AT).replace(/^\s+/, "");

  return (
    <h1 className="ln-heading">
      <span className="ln-heading-light">{light}</span>
      <span className="ln-heading-accent">{accent}</span>
      {!done && <span className="ln-heading-cursor" aria-hidden="true" />}
    </h1>
  );
}

function Orbit({
  spec,
  children,
}: {
  spec: OrbitSpec;
  children?: ReactNode;
}) {
  return (
    <div
      className={`ln-orbit ${spec.reverse ? "ln-orbit-reverse" : ""}`}
      style={
        {
          width: spec.size,
          height: spec.size,
          animationDuration: `${spec.duration}s`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

function Circles() {
  const count = useCountUp(100, 2000, 1200);

  return (
    <div className="ln-circles">
      <div className="ln-radar-sweep" />
      <Orbit spec={ORBITS[0]}>
        <div className="ln-orbit-center">
          <div className="ln-orbit-core">
            <Icon name="shield" size={26} strokeWidth={2} />
          </div>
          <div className="ln-orbit-count">{count}%</div>
          <div className="ln-orbit-label">Human approval</div>
        </div>
      </Orbit>
      <Orbit spec={ORBITS[1]} />
      <Orbit spec={ORBITS[2]} />
      <Orbit spec={ORBITS[3]} />

      {NODES.map((node) => (
        <div
          key={node.label}
          className="ln-node-wrap"
          style={
            {
              transform: `translate(-50%, -50%) rotate(${node.angle}deg) translate(${node.radius}px) rotate(${-node.angle}deg)`,
            } as CSSProperties
          }
        >
          <span className="ln-node-dot" />
          <span className="ln-node-label">{node.label}</span>
        </div>
      ))}
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="ln-app">
      <div className="ln-glow ln-glow-a" />
      <div className="ln-glow ln-glow-b" />

      <header className="ln-header">
        <div className="ln-header-left">
          <img src={LOGO_URL} alt="CreaGuard logo" className="ln-logo" />
          <span className="ln-brand">CreaGuard</span>
          <nav className="ln-nav">
            <a href="#product" className="ln-nav-link">Product</a>
            <Link href="/faq" className="ln-nav-link">How it works</Link>
            <a href="#platforms" className="ln-nav-link">Platforms</a>
          </nav>
        </div>
      </header>

      <main className="ln-hero" id="product">
        <section className="ln-hero-left">
          <TypewriterHeading />
          <div className="ln-cta-row" style={{ animationDelay: "3.2s" }}>
            <PillLink href="/app" variant="right" className="ln-cta">
              <span className="ln-btn-content-inline">
                Open Dashboard <Chevron />
              </span>
            </PillLink>
          </div>
        </section>

        <section className="ln-hero-right">
          <Circles />
        </section>
      </main>

      <section className="ln-ticker-section" id="platforms">
        <div className="ln-ticker">
          <div className="ln-ticker-track">
            {[0, 1, 2, 3].map((group) => (
              <div className="ln-ticker-group" key={group}>
                {PLATFORMS.map((platform) => (
                  <span key={`${group}-${platform.id}`} className="ln-ticker-logo">
                    <BrandIcon name={platform.id} size={22} />
                    <span className="ln-ticker-name">{platform.label}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <p className="ln-ticker-note">
          Built for the communities where creators live
        </p>
      </section>
    </div>
  );
}
