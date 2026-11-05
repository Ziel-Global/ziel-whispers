import { SearchInput } from "@/components/ui/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface LogsFilterBarProps {
  searchQ: string;
  setSearchQ: (q: string) => void;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  employeeFilter: string;
  setEmployeeFilter: (e: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  employees: Array<{ id: string; full_name: string }>;
}

export function LogsFilterBar({
  searchQ,
  setSearchQ,
  selectedDate,
  setSelectedDate,
  employeeFilter,
  setEmployeeFilter,
  statusFilter,
  setStatusFilter,
  employees,
}: LogsFilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2.5 items-center shrink-0">
      <SearchInput
        placeholder="Search employees or descriptions…"
        value={searchQ}
        onChange={(e) => setSearchQ(e.target.value)}
      />

      <input
        type="date"
        value={selectedDate}
        onChange={(e) => setSelectedDate(e.target.value)}
        className="w-[160px] bg-white border border-black/[0.08] rounded-[10px] px-3 py-2 text-[13px] font-semibold text-[#4B4B52] hover:bg-[#F6F5F3] h-[38px] shadow-sm focus:outline-none"
      />

      <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
        <SelectTrigger className="w-[160px] bg-white border border-black/[0.08] rounded-[10px] px-3 py-2 text-[13px] font-semibold text-[#4B4B52] hover:bg-[#F6F5F3] h-[38px] shadow-sm">
          <SelectValue placeholder="Employee" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Employees</SelectItem>
          {employees.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.full_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[140px] bg-white border border-black/[0.08] rounded-[10px] px-3 py-2 text-[13px] font-semibold text-[#4B4B52] hover:bg-[#F6F5F3] h-[38px] shadow-sm">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="missed">Logs Missed</SelectItem>
          <SelectItem value="added">Logs Added</SelectItem>
          <SelectItem value="late">Logs Late</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
