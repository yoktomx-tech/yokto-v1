import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/relationships")({
  head: () => ({ meta: [{ title: "CRM de contrapartes — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: () => <Outlet />,
});
