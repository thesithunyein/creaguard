import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CreaGuard — Creator safety, with context",
  description:
    "CreaGuard is a persistent safety assistant for creators. It connects threats, doxxing, impersonation, scams, and repeated harassment across time while keeping serious actions under human control.",
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
