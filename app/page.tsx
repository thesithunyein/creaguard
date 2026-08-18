import { LandingPage } from "./landing";

export default function Page() {
  return (
    <LandingPage
      clerkEnabled={Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)}
    />
  );
}
