"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Palette,
  LogOut,
} from "lucide-react";
import { TOOLS } from "@/lib/tools/registry";

const topNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

const bottomNavItems = [
  { href: "/brand", label: "Brand", icon: Palette },
];

interface AppShellProps {
  children: React.ReactNode;
  userEmail: string;
}

export function AppShell({ children, userEmail }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-screen">
      <aside className="flex w-60 flex-col border-r bg-muted/30">
        <div className="flex items-center px-4 min-h-[49px]">
          <h1 className="text-lg font-semibold tracking-tight">Mini Mattia</h1>
        </div>
        <Separator />
        <nav className="flex-1 space-y-1 p-2">
          {topNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          {/* Tools section */}
          <div className="pt-3 pb-1">
            <span className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Strumenti
            </span>
          </div>
          {TOOLS.map((tool) => {
            const href = `/tools/${tool.slug}`;
            const isActive = pathname.startsWith(href);
            const Icon = tool.icon;
            return (
              <Link
                key={tool.slug}
                href={href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tool.name}
              </Link>
            );
          })}

          {/* Bottom nav items */}
          <div className="pt-3" />
          {bottomNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Separator />
        <div className="p-4 space-y-3">
          <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Esci
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
