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

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 w-full">
          <TopBar />
          <main className="flex-1 px-6 py-6 md:px-8 md:py-6 overflow-auto bg-background w-full">
            <AutoClockoutAlert />
            {showMissingLog && <MissingLogAlert />}
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

