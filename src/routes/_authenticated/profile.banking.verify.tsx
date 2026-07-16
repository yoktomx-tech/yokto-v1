import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/profile/banking/verify")({
  beforeLoad: () => { throw redirect({ to: "/compliance/bank-accounts/new" }); },
});
