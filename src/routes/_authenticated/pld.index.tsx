import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/pld/")({
  beforeLoad: () => {
    throw redirect({ to: "/score" });
  },
});
