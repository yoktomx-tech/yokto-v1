import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { Toaster } from "../components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-6 py-24">
        <div className="max-w-md text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Error 404</p>
          <h1 className="mt-4 text-5xl text-foreground">Página no encontrada</h1>
          <p className="mt-4 text-muted-foreground">
            La página que buscas no existe o fue movida. Regresa al inicio para continuar.
          </p>
          <Link
            to="/"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Volver al inicio
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-3xl text-foreground">Algo no salió bien</h1>
        <p className="mt-3 text-muted-foreground">
          Ocurrió un error al cargar esta página. Puedes reintentar o volver al inicio.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Reintentar
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CUMPLEX — Pago Seguro contra Cumplimiento" },
      {
        name: "description",
        content:
          "CUMPLEX es la plataforma neutral de pago contra cumplimiento para México. Retenemos fondos y los liberamos solo cuando se verifican las condiciones acordadas entre las partes.",
      },
      { name: "author", content: "CUMPLEX" },
      { name: "theme-color", content: "#09090B" },
      { property: "og:title", content: "CUMPLEX — Pago Seguro contra Cumplimiento" },
      {
        property: "og:description",
        content:
          "CUMPLEX es la plataforma neutral de pago contra cumplimiento para México. Retenemos fondos y los liberamos solo cuando se verifican las condiciones acordadas entre las partes.",
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "es_MX" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "CUMPLEX — Pago Seguro contra Cumplimiento" },
      {
        name: "twitter:description",
        content: "CUMPLEX es la plataforma neutral de pago contra cumplimiento para México. Retenemos fondos y los liberamos solo cuando se verifican las condiciones acordadas entre las partes.",
      },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f0106119-1231-4232-a4a0-b1f0d9fe8e5e/id-preview-3a966e6c--018b237f-9ae4-4e79-8e2f-a64bd6b88fea.lovable.app-1784105564739.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f0106119-1231-4232-a4a0-b1f0d9fe8e5e/id-preview-3a966e6c--018b237f-9ae4-4e79-8e2f-a64bd6b88fea.lovable.app-1784105564739.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster richColors closeButton position="top-right" />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
