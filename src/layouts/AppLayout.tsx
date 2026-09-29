import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { AutoClockoutAlert } from "@/components/AutoClockoutAlert";
import { MissingLogAlert } from "@/components/MissingLogAlert";
import { useAuth } from "@/contexts/AuthContext";

export default function AppLayout() {
  const { profile } = useAuth();
  const showMissingLog = profile?.role === "employee" || profile?.role === "manager";
  const isClient = profile?.role === "client" || profile?.role === "client member"
    || profile?.designation === "Client" || profile?.designation === "Client Member";

  return (
    <SidebarProvider>
      <div className="h-screen flex w-full overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <TopBar />
          <main className={`flex-1 min-h-0 flex flex-col overflow-hidden ${isClient ? "p-4 md:p-[26px_22px_52px] bg-[#F7F8FA]" : "p-3 md:p-6 bg-background"}`}>
            <AutoClockoutAlert />
            {showMissingLog && <MissingLogAlert />}
            <div className="flex-1 min-h-0 overflow-auto flex flex-col">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
