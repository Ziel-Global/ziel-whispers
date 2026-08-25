import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useSkillMetricsData } from "@/hooks/useSkillMetricsData";
import { SKILL_CATEGORIES, SkillCategory } from "@/types/skills";
import { Plus, Search, BookOpen } from "lucide-react";

export function AdminSkillDictionaryTab() {
  const {
    filteredSkills,
    loadingSkills,
    filterCategory,
    setFilterCategory,
    searchQuery,
    setSearchQuery,
    addSkillToDictionary,
  } = useSkillMetricsData();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [skillName, setSkillName] = useState("");
  const [skillCategory, setSkillCategory] = useState<SkillCategory>("Technical");
  const [skillDescription, setSkillDescription] = useState("");

  const handleAdd = async () => {
    if (!skillName.trim()) return;
    await addSkillToDictionary(skillName, skillCategory, skillDescription);
    setAddModalOpen(false);
    setSkillName("");
    setSkillCategory("Technical");
    setSkillDescription("");
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" /> Master Skill Dictionary
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Manage the standard taxonomy of skills used for employee evaluations and project requirement matching.
            </p>
          </div>
          <Button onClick={() => setAddModalOpen(true)} className="rounded-button gap-1 shrink-0">
            <Plus className="h-4 w-4" /> Add New Skill
          </Button>
        </div>
      </Card>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search skill name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {SKILL_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Skills Table / List */}
      {loadingSkills ? (
        <Card className="p-8 text-center text-muted-foreground">Loading skill dictionary…</Card>
      ) : filteredSkills.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No skills found matching filter criteria.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSkills.map((sk) => (
            <Card key={sk.id} className="p-4 flex items-start justify-between gap-3 hover:border-primary/40 transition-colors">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-foreground">{sk.name}</h4>
                  <Badge variant="outline" className="text-[10px]">{sk.category}</Badge>
                </div>
                {sk.description && (
                  <p className="text-xs text-muted-foreground">{sk.description}</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Skill Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Skill to Dictionary</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Skill Name *</Label>
              <Input
                placeholder="e.g. Next.js Architecture"
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Category *</Label>
              <Select value={skillCategory} onValueChange={(v) => setSkillCategory(v as SkillCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SKILL_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Description (Optional)</Label>
              <Input
                placeholder="Short summary of what this skill covers"
                value={skillDescription}
                onChange={(e) => setSkillDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!skillName.trim()} className="rounded-button">
              Add Skill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
