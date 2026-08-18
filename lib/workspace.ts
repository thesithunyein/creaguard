import { auth } from "@clerk/nextjs/server";

/** Workspace used when no one is signed in or Clerk is not configured. */
export function defaultWorkspaceId(): string {
  return process.env.WORKSPACE_ID?.trim() || "demo";
}

export function clerkEnabled(): boolean {
  return Boolean(process.env.CLERK_SECRET_KEY);
}

/**
 * Resolves the caller's workspace. Signed-in creators get their own
 * workspace (their Clerk user id); webhooks and unauthenticated traffic
 * fall back to the env-mapped demo workspace. When Clerk is not configured
 * the app keeps working exactly as the single-workspace demo did before.
 */
export async function currentWorkspaceId(): Promise<string> {
  if (!clerkEnabled()) return defaultWorkspaceId();
  try {
    const { userId } = await auth();
    // When a fixed workspace is configured (single-tenant deployment), the
    // signed-in creator resolves to it too — otherwise the dashboard and the
    // channel webhooks (which have no session) would read/write different
    // workspaces and the creator would see an empty dashboard.
    if (process.env.WORKSPACE_ID?.trim()) return defaultWorkspaceId();
    return userId ?? defaultWorkspaceId();
  } catch {
    return defaultWorkspaceId();
  }
}
