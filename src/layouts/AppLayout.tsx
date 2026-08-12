import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { AutoClockoutAlert } from "@/components/AutoClockoutAlert";
import { MissingLogAlert } from "@/components/MissingLogAlert";
import { useAuth } from "@/contexts/AuthContext";

export default function AppLayout() {
  const { profile } = useAuth();
  const showMissingLog =
    profile?.role === "employee" || profile?.role === "manager";

  return (
    <SidebarProvider>
      <div className="h-screen flex w-full overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 h-screen">
          <TopBar />
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 bg-background">
            <AutoClockoutAlert />
            {showMissingLog && <MissingLogAlert />}
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
