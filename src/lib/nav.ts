import {
  BarChart3, Building2, FileCheck, FilePlus2, FileText, Gavel, GitCompare, Inbox, LayoutDashboard,
  Package, Send, Settings, ShieldCheck, Tags, Users, Wallet, Database, Plug, BookOpen, Rocket,
  type LucideIcon,
} from "lucide-react";
import type { TKey } from "./translations";

export type Area = "app" | "supplier" | "admin";
export type NavItem = { slug: string; key: TKey; icon: LucideIcon };

export const NAV: Record<Area, NavItem[]> = {
  app: [
    { slug: "", key: "nav.dashboard", icon: LayoutDashboard },
    { slug: "create-rfq", key: "nav.createRfq", icon: FilePlus2 },
    { slug: "rfqs", key: "nav.rfqs", icon: FileText },
    { slug: "compare", key: "nav.compare", icon: GitCompare },
    { slug: "orders", key: "nav.orders", icon: Package },
    { slug: "group-buy", key: "nav.groupBuy", icon: Users },
    { slug: "price-index", key: "nav.priceIndex", icon: BarChart3 },
    { slug: "settings", key: "nav.settings", icon: Settings },
  ],
  supplier: [
    { slug: "", key: "nav.dashboard", icon: LayoutDashboard },
    { slug: "inbox", key: "nav.inbox", icon: Inbox },
    { slug: "quotes", key: "nav.quotes", icon: Send },
    { slug: "agreements", key: "nav.agreements", icon: FileCheck },
    { slug: "orders", key: "nav.orders", icon: Package },
    { slug: "pools", key: "nav.pools", icon: Users },
    { slug: "catalogue", key: "nav.catalogue", icon: BookOpen },
    { slug: "profile", key: "nav.profile", icon: Building2 },
    { slug: "earnings", key: "nav.earnings", icon: Wallet },
  ],
  admin: [
    { slug: "", key: "nav.dashboard", icon: LayoutDashboard },
    { slug: "categories", key: "nav.categories", icon: Tags },
    { slug: "companies", key: "nav.companies", icon: Building2 },
    { slug: "trust-scores", key: "nav.trustScores", icon: ShieldCheck },
    { slug: "disputes", key: "nav.disputes", icon: Gavel },
    { slug: "pools", key: "nav.pools", icon: Users },
    { slug: "integrations", key: "nav.integrations", icon: Plug },
    { slug: "go-live", key: "nav.goLive", icon: Rocket },
    { slug: "demo-data", key: "nav.demoData", icon: Database },
  ],
};

export const findNav = (area: Area, slug: string) => NAV[area].find((i) => i.slug === slug);
