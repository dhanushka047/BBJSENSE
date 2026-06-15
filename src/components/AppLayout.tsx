import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Cpu,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Shield,
  FileText,
  HardDrive,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Devices", icon: Cpu, path: "/devices" },
  { label: "Approvals", icon: Shield, path: "/admin/approvals", roles: ["super_admin", "admin"] as const },
  { label: "Users", icon: Users, path: "/admin/users", roles: ["super_admin", "admin"] as const },
  { label: "API Docs", icon: FileText, path: "/admin/docs", roles: ["super_admin"] as const },
  { label: "Backup", icon: HardDrive, path: "/admin/backup", roles: ["super_admin"] as const },
  { label: "Settings", icon: Settings, path: "/settings" },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut } = useAuth();

  const userName = profile ? `${profile.first_name} ${profile.last_name}`.trim() || profile.email : "User";

  const filteredNav = navItems.filter(
    (item) => !item.roles || (item.roles as readonly string[]).includes(role)
  );

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <BrandLogo size="small" />
          <button className="lg:hidden text-sidebar-foreground" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}>
                <item.icon size={18} />
                {item.label}
                {item.roles && <Shield size={12} className="ml-auto opacity-50" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-sidebar-accent">
            <div className="w-8 h-8 rounded-full gradient-brand flex items-center justify-center text-primary-foreground text-xs font-bold">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-sidebar-accent-foreground">{userName}</p>
              <p className="text-xs text-sidebar-foreground opacity-60 capitalize">{role.replace("_", " ")}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full mt-2 justify-start text-sidebar-foreground opacity-70 hover:opacity-100" onClick={handleSignOut}>
            <LogOut size={16} className="mr-2" /> Sign Out
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between h-14 px-4 border-b border-border bg-card/50">
          <button className="lg:hidden text-foreground" onClick={() => setSidebarOpen(true)}><Menu size={22} /></button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2"><ThemeToggle /></div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
