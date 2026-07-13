import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/kyc")({
  beforeLoad: () => { throw redirect({ to: "/onboarding" }); },
});
