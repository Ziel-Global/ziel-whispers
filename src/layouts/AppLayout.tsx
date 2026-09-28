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
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className={`flex-1 overflow-auto ${isClient ? "p-4 md:p-[26px_22px_52px] bg-[#F7F8FA]" : "p-3 md:p-6 bg-background"}`}>
            <AutoClockoutAlert />
            {showMissingLog && <MissingLogAlert />}
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
