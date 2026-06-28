import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Home, LayoutDashboard, BookOpen, LogOut, Moon, Sun, Coffee, Leaf, GraduationCap, User2, ChevronUp, Puzzle, Trophy, ClipboardList, Palette, Cloud, Droplet } from "lucide-react";
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
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger, 
  DropdownMenuSub, 
  DropdownMenuSubTrigger, 
  DropdownMenuPortal, 
  DropdownMenuSubContent 
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

const items = [
  { title: "Home", url: "/", icon: Home },
  { title: "Dashboard", url: "/app/dashboard", icon: LayoutDashboard },
  { title: "Study Agent", url: "/app/study", icon: BookOpen },
  { title: "AI Tutor", url: "/app/tutor", icon: GraduationCap },
  { title: "Mock Test", url: "/app/mock-test", icon: ClipboardList },
  { title: "Extension", url: "/app/extension", icon: Puzzle },
] as const;

export function AppSidebar() {
  const { setOpenMobile, isMobile, state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground h-12"
                  tooltip="Account"
                >
                  <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <User2 className="size-4" />
                  </div>
                  {!collapsed && user && (
                    <>
                      <div className="grid flex-1 text-left text-sm leading-tight ml-2">
                        <span className="truncate font-semibold">{user.full_name || user.email}</span>
                        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                      </div>
                      <ChevronUp className="ml-auto size-4 text-muted-foreground" />
                    </>
                  )}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={isMobile ? "bottom" : "right"}
                align={isMobile ? "end" : "end"}
                className="w-56 rounded-lg"
              >
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer">
                    <Palette className="mr-2 h-4 w-4" />
                    <span>Theme Changer</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => { setTheme("mocha"); closeMobile(); }} className="cursor-pointer">
                        <Coffee className="mr-2 h-4 w-4" /> Mocha
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setTheme("cappuccino"); closeMobile(); }} className="cursor-pointer">
                        <Cloud className="mr-2 h-4 w-4" /> Cappuccino
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setTheme("latte"); closeMobile(); }} className="cursor-pointer">
                        <Droplet className="mr-2 h-4 w-4" /> Latte
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setTheme("matcha"); closeMobile(); }} className="cursor-pointer">
                        <Leaf className="mr-2 h-4 w-4" /> Matcha
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuItem onClick={onSignOut} className="text-red-500 cursor-pointer focus:bg-red-500/10 focus:text-red-500">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
