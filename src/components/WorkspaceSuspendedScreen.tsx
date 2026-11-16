import { Button } from "@/components/ui/button";
import { AlertTriangle, LogOut, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function WorkspaceSuspendedScreen() {
  const { tenant, signOut } = useAuth();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0F1012] p-4 text-white">
      <div className="max-w-md w-full bg-[#18191C] border border-white/10 rounded-2xl p-8 text-center shadow-2xl space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Workspace Suspended</h1>
          <p className="text-sm text-neutral-400">
            The workspace <span className="font-semibold text-neutral-200">"{tenant?.name || "your organization"}"</span> has been temporarily suspended by the platform administrator.
          </p>
        </div>

        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-xs text-neutral-400 text-left space-y-2">
          <div className="flex items-center gap-2 text-neutral-300 font-medium">
            <Mail className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Need assistance?</span>
          </div>
          <p>
            Please contact your organization's administrator or the platform support team to resolve this suspension.
          </p>
        </div>

        <Button
          onClick={() => void signOut()}
          variant="outline"
          className="w-full border-white/10 text-white hover:bg-white/5 hover:text-white"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

