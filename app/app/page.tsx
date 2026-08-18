import { CreaGuardApp } from "../creaguard-app";

export default function AppPage() {
  return (
    <CreaGuardApp
      clerkEnabled={Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)}
    />
  );
}
