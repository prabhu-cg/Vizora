import { Clock, LayoutDashboard, Settings, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const APP_NAV: NavItem[] = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/recent", label: "Recent", icon: Clock },
  { href: "/app/settings", label: "Settings", icon: Settings },
];
