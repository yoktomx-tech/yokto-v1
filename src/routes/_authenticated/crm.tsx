import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [{ title: "CRM de contrapartes — CUMPLEX" }, { name: "robots", content: "noindex" }] }),
  component: () => <Outlet />,
});
