import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

export function CompanyHolidaysCard() {
  const queryClient = useQueryClient();
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ["company-holidays-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holidays")
        .select("id, date, name, region")
        .order("date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayDate || !holidayName.trim()) {
      toast.error("Please provide both date and holiday name");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("holidays").insert({
        date: holidayDate,
        name: holidayName.trim(),
      });
      if (error) throw error;

      toast.success("Holiday added successfully");
      setHolidayDate("");
      setHolidayName("");
      queryClient.invalidateQueries({ queryKey: ["company-holidays-admin"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to add holiday");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteHoliday = async (id: string, name: string) => {
    try {
      const { error } = await supabase.from("holidays").delete().eq("id", id);
      if (error) throw error;
      toast.success(`Removed holiday: ${name}`);
      queryClient.invalidateQueries({ queryKey: ["company-holidays-admin"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to remove holiday");
    }
  };

  return (
    <Card className="p-6 border border-black/[0.08] dark:border-white/[0.08] rounded-xl bg-card space-y-5">
      <div className="flex items-center justify-between pb-3 border-b">
        <div>
          <h3 className="text-sm font-bold text-foreground">Official Company Holidays</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Dates recognized as official non-working holidays. Subtracted from gross working capacity in Analytics.
          </p>
        </div>
        <Badge variant="secondary" className="text-xs font-semibold">
          {holidays.length} Configured
        </Badge>
      </div>

      {/* Add Holiday Form */}
      <form onSubmit={handleAddHoliday} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Holiday Date *</label>
          <Input
            type="date"
            value={holidayDate}
            onChange={(e) => setHolidayDate(e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Holiday Name *</label>
          <Input
            placeholder="e.g. Eid-ul-Fitr, Independence Day"
            value={holidayName}
            onChange={(e) => setHolidayName(e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting}
          className="h-8 text-xs font-semibold gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          {isSubmitting ? "Adding…" : "Add Holiday"}
        </Button>
      </form>

      {/* Holidays List */}
      <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04] mt-2">
        {isLoading ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Loading holidays...</p>
        ) : holidays.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            No official company holidays added yet.
          </p>
        ) : (
          holidays.map((h) => (
            <div key={h.id} className="py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <Calendar className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="font-semibold text-foreground">{h.name}</span>
                  <span className="text-[11px] text-muted-foreground block font-mono">
                    {format(new Date(h.date + "T00:00:00"), "EEEE, MMMM d, yyyy")}
                  </span>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => handleDeleteHoliday(h.id, h.name)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

