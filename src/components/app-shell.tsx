import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Bell, Search } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/use-account";
import { useI18n } from "@/lib/i18n";
import { NAV, type Area } from "@/lib/nav";
import { LangToggle } from "@/components/lang-toggle";

export function AppShell({ area, children }: { area: Area; children: ReactNode }) {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: account } = useAccount();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const name = account?.profile?.full_name ?? account?.user.email ?? "";
  const initials = name.split(/[\s@]/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="px-3 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-sidebar-primary font-display text-xs font-extrabold text-sidebar-primary-foreground">
              BS
            </span>
            <span className="font-display text-base font-bold group-data-[collapsible=icon]:hidden">BuildSource LT</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/60">{t(`area.${area}`)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV[area].map((item) => {
                  const href = item.slug ? `/${area}/${item.slug}` : `/${area}`;
                  const active = item.slug ? pathname.startsWith(href) : pathname === href || pathname === `${href}/`;
                  return (
                    <SidebarMenuItem key={item.slug || "home"}>
                      <SidebarMenuButton asChild isActive={active} tooltip={t(item.key)}>
                        <Link to={href as "/app"}>
                          <item.icon />
                          <span>{t(item.key)}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur">
          <SidebarTrigger />
          <div className="relative hidden max-w-md flex-1 sm:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={t("top.search")} className="h-9 pl-9" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="rounded-full border border-warning/50 bg-warning/15 px-2.5 py-0.5 text-xs font-semibold text-foreground">
              {t("top.demo")}
            </span>
            <LangToggle />
            <Button variant="ghost" size="icon" aria-label={t("top.notifications")}>
              <Bell />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button aria-label="User menu" className="rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-ink text-xs text-ink-foreground">{initials || "?"}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">{t("top.switchArea")}</DropdownMenuLabel>
                <DropdownMenuItem asChild><Link to="/app">{t("area.app")}</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/supplier">{t("area.supplier")}</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/admin">{t("area.admin")}</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>{t("top.signOut")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export function SectionPlaceholder({ area, slug }: { area: Area; slug: string }) {
  const { t } = useI18n();
  const item = NAV[area].find((i) => i.slug === slug);
  if (!item) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t(`area.${area}`)}</p>
      <h1 className="mt-1 text-3xl">{t(item.key)}</h1>
      <div className="mt-8 grid place-items-center rounded-lg border border-dashed border-border bg-card p-16 text-center">
        <item.icon className="h-8 w-8 text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">{t("placeholder.soon")}</p>
      </div>
    </div>
  );
}
