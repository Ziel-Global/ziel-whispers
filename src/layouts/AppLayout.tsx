import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Button } from "@/components/ui/button";
import { Eye, X } from "lucide-react";

export default function AppLayout() {
  const { impersonating, stopImpersonation } = useImpersonation();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {impersonating && (
            <div className="bg-yellow-400 text-yellow-900 px-4 py-2 flex items-center justify-between text-sm font-medium">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span>Viewing as {impersonating.name} — this is read-only</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-yellow-900 hover:bg-yellow-500"
                onClick={stopImpersonation}
              >
                <X className="h-3 w-3 mr-1" />Exit View
              </Button>
            </div>
          )}
          <TopBar />
          <main className="flex-1 p-6 overflow-auto bg-background">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
