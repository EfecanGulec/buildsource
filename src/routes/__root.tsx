import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { isChunkLoadError, reloadOnce } from "../lib/chunk-recovery";
import { refreshCurrentPage } from "../lib/chunk-recovery";
import { Button } from "@/components/ui/button";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  const stale = isChunkLoadError(error);
  useEffect(() => {
    if (stale && reloadOnce()) return;
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {stale ? "A new version is available" : "This page didn't load"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {stale
            ? "The app was updated while this page was open. Refresh to load the latest version."
            : "Something went wrong on our end. You can try refreshing or head back home."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              if (stale) return refreshCurrentPage();
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </Button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    // Replace these placeholders with the app's name and description when first building the app.
    // Each content route, / included, must still set its own head(). Never add og:image or
    // twitter:image here: every page without its own would inherit the root's preview image.
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "BuildSource LT — B2B sourcing for construction" },
      { name: "description", content: "Request quotes, compare suppliers and track orders for construction, renovation and interior projects in Lithuania." },
      { property: "og:title", content: "BuildSource LT" },
      { property: "og:description", content: "B2B sourcing platform for Lithuanian construction professionals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
          ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

// Runs before any app code, so it also catches the case where the main page files themselves
// are stale (after an update or preview restart) and the app never starts. Shares the retry state
// key and limits (3 quick reloads, then 3 more 10 s apart, per 2 minutes) with src/lib/chunk-recovery.ts.
const EARLY_RECOVERY = `(function(){var K="bs-chunk-reload",P=/importing a module script failed|failed to fetch dynamically imported module|error loading dynamically imported module/i;
function s(){var f=function(){if(document.getElementById("bs-stale"))return;var d=document.createElement("div");d.id="bs-stale";d.style.cssText="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#F7F8F6;font-family:sans-serif;z-index:99999;text-align:center;padding:16px";d.innerHTML="<div><p style=\\"font-size:18px;font-weight:600;color:#1A1A1A\\">The app is updating</p><p style=\\"color:#555;margin:8px 0 16px\\">Give it a moment, then refresh.</p><button onclick=\\"sessionStorage.removeItem('bs-chunk-reload');location.reload()\\" style=\\"background:#0F5D3A;color:#fff;border:0;border-radius:6px;padding:8px 16px;cursor:pointer\\">Refresh</button></div>";document.body.appendChild(d)};document.body?f():addEventListener("DOMContentLoaded",f)}
function r(){if(window.__bsR)return true;var n=Date.now(),st=null;try{st=JSON.parse(sessionStorage.getItem(K)||"null")}catch(e){}if(!st||n-st.first>120000)st={first:n,count:0};if(st.count>=6){s();return false}var d=st.count<3?st.count*800:10000;st.count++;try{sessionStorage.setItem(K,JSON.stringify(st))}catch(e){}window.__bsR=1;setTimeout(function(){var u=new URL(location.href);u.searchParams.set("__bs_refresh",String(Date.now()));location.replace(u.href)},d);return true}window.__bsReload=r;
addEventListener("error",function(e){var t=e.target;if(t&&t.tagName==="SCRIPT"&&t.type==="module"){r();return}if(P.test(String(e.message||"")))r()},true);
addEventListener("unhandledrejection",function(e){var m=e.reason&&e.reason.message||String(e.reason||"");if(P.test(m))r()});})();`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: EARLY_RECOVERY }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <I18nProvider>
        <Outlet />
        <Toaster />
      </I18nProvider>
    </QueryClientProvider>
  );
}
