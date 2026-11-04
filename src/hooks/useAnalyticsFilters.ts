import { useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AnalyticsFilterState,
  DateRangePreset,
  ComparisonType,
  Granularity,
  DEFAULT_ANALYTICS_FILTERS,
  resolveDateRange,
  filtersToSearchParams,
  searchParamsToFilters,
  countActiveFilters,
} from "@/lib/analytics-filter-utils";

export interface AnalyticsFilterOption {
  id: string;
  name: string;
  parentId?: string | null;
}

export function useAnalyticsFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  // 1. Parse active filters from URL query parameters
  const filters: AnalyticsFilterState = useMemo(() => {
    return searchParamsToFilters(searchParams);
  }, [searchParams]);

  // 2. Resolve date range to exact dates & comparison window
  const resolvedRange = useMemo(() => {
    return resolveDateRange(
      filters.preset,
      filters.customStartDate,
      filters.customEndDate,
      filters.comparison
    );
  }, [filters.preset, filters.customStartDate, filters.customEndDate, filters.comparison]);

  // 3. Update search params helper
  const updateFilters = useCallback(
    (updater: (prev: AnalyticsFilterState) => AnalyticsFilterState) => {
      const next = updater(filters);
      const newParams = filtersToSearchParams(next);
      setSearchParams(newParams, { replace: true });
    },
    [filters, setSearchParams]
  );

  // 4. Fetch cascading filter options
  // Clients
  const { data: clients = [] } = useQuery({
    queryKey: ["analytics-filter-clients"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .order("name", { ascending: true });
      return data || [];
    },
    staleTime: 60000,
  });

  // Projects
  const { data: allProjects = [] } = useQuery({
    queryKey: ["analytics-filter-projects"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, client_id, status")
        .neq("status", "archived")
        .order("name", { ascending: true });
      return data || [];
    },
    staleTime: 60000,
  });

  // Sprints
  const { data: allSprints = [] } = useQuery({
    queryKey: ["analytics-filter-sprints"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sprints")
        .select("id, name, project_id, status")
        .order("start_date", { ascending: false });
      return data || [];
    },
    staleTime: 60000,
  });

  // Employees & Departments
  const { data: allEmployees = [] } = useQuery({
    queryKey: ["analytics-filter-employees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("id, full_name, department, designation, role, avatar_url")
        .is("left_at", null)
        .order("full_name", { ascending: true });
      return data || [];
    },
    staleTime: 60000,
  });

  // 5. Compute cascading options
  const projects = useMemo(() => {
    if (!filters.clientId) return allProjects;
    return allProjects.filter((p) => p.client_id === filters.clientId);
  }, [allProjects, filters.clientId]);

  const sprints = useMemo(() => {
    if (!filters.projectId) return allSprints;
    return allSprints.filter((s) => s.project_id === filters.projectId);
  }, [allSprints, filters.projectId]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    allEmployees.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set).sort();
  }, [allEmployees]);

  const roles = useMemo(() => {
    const set = new Set<string>();
    allEmployees.forEach((e) => {
      if (e.designation) set.add(e.designation);
      else if (e.role) set.add(e.role);
    });
    return Array.from(set).sort();
  }, [allEmployees]);

  const employees = useMemo(() => {
    return allEmployees.filter((e) => {
      if (filters.department && e.department !== filters.department) return false;
      if (filters.role && e.designation !== filters.role && e.role !== filters.role) return false;
      return true;
    });
  }, [allEmployees, filters.department, filters.role]);

  // 6. Explicit Setters
  const setPreset = useCallback(
    (preset: DateRangePreset, customStart?: string, customEnd?: string) => {
      updateFilters((prev) => ({
        ...prev,
        preset,
        customStartDate: customStart,
        customEndDate: customEnd,
      }));
    },
    [updateFilters]
  );

  const setComparison = useCallback(
    (comparison: ComparisonType) => {
      updateFilters((prev) => ({ ...prev, comparison }));
    },
    [updateFilters]
  );

  const setGranularity = useCallback(
    (granularity: Granularity) => {
      updateFilters((prev) => ({ ...prev, granularity }));
    },
    [updateFilters]
  );

  const setClientId = useCallback(
    (clientId: string | null) => {
      updateFilters((prev) => {
        // Cascade: if selected project doesn't belong to new client, clear it
        let nextProj = prev.projectId;
        if (clientId && nextProj) {
          const match = allProjects.find((p) => p.id === nextProj);
          if (match && match.client_id !== clientId) nextProj = null;
        }
        return {
          ...prev,
          clientId,
          projectId: nextProj,
          sprintId: nextProj ? prev.sprintId : null,
        };
      });
    },
    [updateFilters, allProjects]
  );

  const setProjectId = useCallback(
    (projectId: string | null) => {
      updateFilters((prev) => {
        // Automatically set client if project has one
        let nextClient = prev.clientId;
        if (projectId) {
          const match = allProjects.find((p) => p.id === projectId);
          if (match?.client_id) nextClient = match.client_id;
        }
        return {
          ...prev,
          projectId,
          clientId: nextClient,
          sprintId: null, // Reset sprint when project changes
        };
      });
    },
    [updateFilters, allProjects]
  );

  const setSprintId = useCallback(
    (sprintId: string | null) => {
      updateFilters((prev) => ({ ...prev, sprintId }));
    },
    [updateFilters]
  );

  const setDepartment = useCallback(
    (department: string | null) => {
      updateFilters((prev) => ({
        ...prev,
        department,
        userId: null, // Reset employee if department filter changes
      }));
    },
    [updateFilters]
  );

  const setRole = useCallback(
    (role: string | null) => {
      updateFilters((prev) => ({
        ...prev,
        role,
        userId: null,
      }));
    },
    [updateFilters]
  );

  const setUserId = useCallback(
    (userId: string | null) => {
      updateFilters((prev) => ({ ...prev, userId }));
    },
    [updateFilters]
  );

  const setWorkMode = useCallback(
    (workMode: "all" | "onsite" | "remote") => {
      updateFilters((prev) => ({ ...prev, workMode }));
    },
    [updateFilters]
  );

  const setBillableOnly = useCallback(
    (billableOnly: boolean) => {
      updateFilters((prev) => ({ ...prev, billableOnly }));
    },
    [updateFilters]
  );

  const clearNonDateFilters = useCallback(() => {
    updateFilters((prev) => ({
      ...prev,
      clientId: null,
      projectId: null,
      sprintId: null,
      department: null,
      role: null,
      userId: null,
      workMode: "all",
      billableOnly: false,
    }));
  }, [updateFilters]);

  const resetAllFilters = useCallback(() => {
    const newParams = filtersToSearchParams(DEFAULT_ANALYTICS_FILTERS);
    setSearchParams(newParams, { replace: true });
  }, [setSearchParams]);

  const applySavedFilterState = useCallback(
    (savedState: Partial<AnalyticsFilterState>) => {
      updateFilters((prev) => ({
        ...prev,
        ...savedState,
      }));
    },
    [updateFilters]
  );

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  return {
    filters,
    resolvedRange,
    activeFilterCount,
    // Options
    clients,
    projects,
    sprints,
    departments,
    roles,
    employees,
    // Setters
    setPreset,
    setComparison,
    setGranularity,
    setClientId,
    setProjectId,
    setSprintId,
    setDepartment,
    setRole,
    setUserId,
    setWorkMode,
    setBillableOnly,
    clearNonDateFilters,
    resetAllFilters,
    applySavedFilterState,
  };
}
