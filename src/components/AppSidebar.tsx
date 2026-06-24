import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Home, LayoutDashboard, BookOpen, LogOut, Moon, Sun, Coffee, Leaf, GraduationCap } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

const items = [
  { title: "Home", url: "/", icon: Home },
  { title: "Dashboard", url: "/app/dashboard", icon: LayoutDashboard },
  { title: "Study Agent", url: "/app/study", icon: BookOpen },
  { title: "AI Tutor", url: "/app/tutor", icon: GraduationCap },
] as const;

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { logout, user } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const onSignOut = async () => {
    closeMobile();
    await logout();
    navigate({ to: "/auth/login" });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className={`flex items-center gap-2 py-2 ${collapsed ? "justify-center px-0" : "px-2"}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Coffee className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">GraspAI</span>
              <span className="text-xs text-muted-foreground">Study, brewed.</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = path === item.url || path.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-3" onClick={closeMobile}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="pb-6 sm:pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => { toggle(); closeMobile(); }} tooltip={theme === "mocha" ? "Latte mode" : "Mocha mode"}>
              {theme === "mocha" ? <Leaf className="h-4 w-4" /> : <Coffee className="h-4 w-4" />}
              {!collapsed && <span>{theme === "mocha" ? "Latte mode" : "Mocha mode"}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
          {!collapsed && user && (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              <div className="truncate font-medium text-foreground">{user.full_name || user.email}</div>
              <div className="truncate">{user.email}</div>
            </div>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onSignOut} tooltip="Sign out" className="hover:bg-red-500/10 hover:text-red-500">
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sign out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}