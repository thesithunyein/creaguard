import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
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
  // Clerk is optional: without a publishable key the app keeps working as
  // the single demo workspace (sign-in simply doesn't appear).
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return (
    <html lang="en">
      <body>
        {publishableKey ? (
          <ClerkProvider publishableKey={publishableKey}>
            {children}
          </ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
