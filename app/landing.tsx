"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { BrandIcon, Icon } from "./icons";

const FULL_TEXT = "Creator Safety That Remembers Context -- Not Just Rules.";
const SPLIT_AT = 42;
const LOGO_URL = "/logo.png";

interface OrbitSpec {
  size: number;
  duration: number;
  reverse: boolean;
}

interface IconSpec {
  icon: string;
  angle: number;
  radius: number;
  size: number;
  square?: boolean;
  glow: string;
  delay: number;
}

const ORBITS: OrbitSpec[] = [
  { size: 353, duration: 30, reverse: true },
  { size: 501, duration: 40, reverse: false },
  { size: 649, duration: 50, reverse: false },
  { size: 797, duration: 60, reverse: true },
];

const ICONS: IconSpec[] = [
  { icon: "alert-triangle", angle: 270, radius: 177, size: 58, square: true, glow: "#4CD137", delay: 0.6 },
  { icon: "flag", angle: 60, radius: 251, size: 58, glow: "#FBBF24", delay: 0.8 },
  { icon: "trending-up", angle: 180, radius: 251, size: 78, glow: "#F87171", delay: 1.0 },
  { icon: "sparkles", angle: 300, radius: 251, size: 58, square: true, glow: "#60A5FA", delay: 1.2 },
  { icon: "message-circle", angle: 130, radius: 325, size: 88, glow: "#F472B6", delay: 1.4 },
  { icon: "check-circle", angle: 30, radius: 399, size: 58, glow: "#4CD137", delay: 1.6 },
  { icon: "lock", angle: 95, radius: 399, size: 88, square: true, glow: "#FB923C", delay: 1.8 },
  { icon: "shield", angle: 220, radius: 399, size: 88, square: true, glow: "#F472B6", delay: 2.0 },
  { icon: "eye", angle: 320, radius: 399, size: 58, glow: "#A3E635", delay: 2.3 },
];

const PLATFORMS = [
  { id: "youtube", label: "YouTube" },
  { id: "discord", label: "Discord" },
  { id: "telegram", label: "Telegram" },
  { id: "instagram", label: "Instagram" },
  { id: "twitch", label: "Twitch" },
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

function CursorArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 2.5v18l5.6-6.1 3.1 7.1 2.2-.9-3.1-7 6.7-1.8L4 2.5z"
        fill="#4CD137"
      />
    </svg>
  );
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
  const accent = typed.slice(SPLIT_AT);

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
      <Orbit spec={ORBITS[0]}>
        <div className="ln-orbit-center">
          <div className="ln-orbit-count">{count}%</div>
          <div className="ln-orbit-label">Human approval</div>
        </div>
      </Orbit>
      <Orbit spec={ORBITS[1]} />
      <Orbit spec={ORBITS[2]} />
      <Orbit spec={ORBITS[3]} />

      {ICONS.map((icon, index) => (
        <div
          key={`${icon.icon}-${index}`}
          className="ln-icon-wrap"
          style={
            {
              "--fly-delay": `${icon.delay}s`,
              transform: `translate(-50%, -50%) rotate(${icon.angle}deg) translate(${icon.radius}px) rotate(${-icon.angle}deg)`,
              "--glow": icon.glow,
            } as CSSProperties
          }
        >
          <span
            className={`ln-icon ${icon.square ? "ln-icon-square" : ""}`}
            style={
              {
                width: icon.size,
                height: icon.size,
              } as CSSProperties
            }
          >
            <Icon name={icon.icon} size={icon.size >= 78 ? 34 : 24} strokeWidth={2.2} />
          </span>
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
            <a href="#safety" className="ln-nav-link">Safety</a>
            <a href="#platforms" className="ln-nav-link">Platforms</a>
          </nav>
        </div>
        <div className="ln-header-right">
          <Link href="/app" className="ln-signin">Sign in</Link>
          <PillLink href="/app" variant="left">Open Dashboard</PillLink>
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
          <div className="ln-cursor-label" style={{ animationDelay: "3.6s" }}>
            <CursorArrow />
            <span className="ln-cursor-name">Your safety Mind</span>
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
