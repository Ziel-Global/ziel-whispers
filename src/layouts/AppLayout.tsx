import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { AutoClockoutAlert } from "@/components/AutoClockoutAlert";
import { MissingLogAlert } from "@/components/MissingLogAlert";

export default function AppLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 p-6 overflow-auto bg-background">
            <AutoClockoutAlert />
            <MissingLogAlert />
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
