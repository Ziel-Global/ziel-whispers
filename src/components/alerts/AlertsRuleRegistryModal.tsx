import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ALERT_RULES_REGISTRY } from "@/lib/alerts/alertEngine";
import { ShieldCheck, CheckCircle2 } from "lucide-react";

interface AlertsRuleRegistryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AlertsRuleRegistryModal({ isOpen, onClose }: AlertsRuleRegistryModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Automated Alert Rules Registry (Blueprint S5.2)
              </DialogTitle>
              <DialogDescription className="text-xs">
                12 continuous automated triggers monitoring workforce health, delivery SLAs, and compliance
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 pt-2">
          {ALERT_RULES_REGISTRY.map((rule, idx) => (
            <div
              key={rule.id}
              className="p-3 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-muted/20 text-xs space-y-1.5 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground font-semibold">
                    #{idx + 1} {rule.id}
                  </span>
                  <Badge
                    variant={rule.defaultSeverity === "critical" ? "destructive" : "outline"}
                    className="text-[9px] uppercase px-1.5 py-0 font-bold"
                  >
                    {rule.defaultSeverity}
                  </Badge>
                  <Badge variant="secondary" className="text-[9px] uppercase font-semibold">
                    {rule.category}
                  </Badge>
                </div>

                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px]">
                  <CheckCircle2 className="h-3 w-3" /> Active
                </span>
              </div>

              <h4 className="font-bold text-foreground text-xs">{rule.name}</h4>
              <p className="text-muted-foreground text-[11px]">{rule.description}</p>

              <div className="pt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground border-t border-black/[0.04] dark:border-white/[0.04]">
                <span>
                  Threshold: <strong className="text-foreground">{rule.thresholdDescription}</strong>
                </span>
                <span>
                  Roles:{" "}
                  <strong className="text-foreground">
                    {rule.targetRoles.join(", ")}
                  </strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

