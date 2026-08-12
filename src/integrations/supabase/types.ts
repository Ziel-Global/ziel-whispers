export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      announcement_reads: {
        Row: {
          announcement_id: string | null
          dismissed: boolean
          id: string
          read_at: string
          user_id: string | null
        }
        Insert: {
          announcement_id?: string | null
          dismissed?: boolean
          id?: string
          read_at?: string
          user_id?: string | null
        }
        Update: {
          announcement_id?: string | null
          dismissed?: boolean
          id?: string
          read_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          priority: string
          publish_at: string
          title: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          priority?: string
          publish_at?: string
          title: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          priority?: string
          publish_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          auto_clocked_out: boolean
          auto_clockout_notes: string | null
          clock_in: string | null
          clock_out: string | null
          created_at: string
          date: string
          edited_by: string | null
          hours_late: number
          id: string
          is_late: boolean
          log_reminder_sent: boolean
          log_reminder_time: string | null
          minutes_late: number
          notes: string | null
          user_id: string | null
          work_mode: string | null
        }
        Insert: {
          auto_clocked_out?: boolean
          auto_clockout_notes?: string | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date: string
          edited_by?: string | null
          hours_late?: number
          id?: string
          is_late?: boolean
          log_reminder_sent?: boolean
          log_reminder_time?: string | null
          minutes_late?: number
          notes?: string | null
          user_id?: string | null
          work_mode?: string | null
        }
        Update: {
          auto_clocked_out?: boolean
          auto_clockout_notes?: string | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date?: string
          edited_by?: string | null
          hours_late?: number
          id?: string
          is_late?: boolean
          log_reminder_sent?: boolean
          log_reminder_time?: string | null
          minutes_late?: number
          notes?: string | null
          user_id?: string | null
          work_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          target_entity: string | null
          target_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_entity?: string | null
          target_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_entity?: string | null
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_clockout_acks: {
        Row: {
          acknowledged_at: string
          attendance_id: string
          id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          attendance_id: string
          id?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          attendance_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      client_action_items: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          project_id: string
          requested_by: string | null
          status: string
          title: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          project_id: string
          requested_by?: string | null
          status?: string
          title: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          project_id?: string
          requested_by?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_action_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_action_items_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_messages: {
        Row: {
          active: boolean
          body: string | null
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_url: string | null
          id: string
          project_id: string
          title: string
        }
        Insert: {
          active?: boolean
          body?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          project_id: string
          title: string
        }
        Update: {
          active?: boolean
          body?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          project_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          industry: string | null
          name: string
          notes: string | null
          status: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          name: string
          notes?: string | null
          status?: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          name?: string
          notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_logs: {
        Row: {
          admin_comment: string | null
          admin_flagged: boolean
          category: string
          created_at: string
          description: string
          hours: number
          id: string
          is_late: boolean
          is_locked: boolean
          is_missed: boolean
          is_overtime: boolean | null
          log_date: string
          project_id: string | null
          status: string
          status_id: string | null
          submitted_at: string
          task_id: string | null
          user_id: string | null
        }
        Insert: {
          admin_comment?: string | null
          admin_flagged?: boolean
          category: string
          created_at?: string
          description: string
          hours: number
          id?: string
          is_late?: boolean
          is_locked?: boolean
          is_missed?: boolean
          is_overtime?: boolean | null
          log_date: string
          project_id?: string | null
          status?: string
          status_id?: string | null
          submitted_at?: string
          task_id?: string | null
          user_id?: string | null
        }
        Update: {
          admin_comment?: string | null
          admin_flagged?: boolean
          category?: string
          created_at?: string
          description?: string
          hours?: number
          id?: string
          is_late?: boolean
          is_locked?: boolean
          is_missed?: boolean
          is_overtime?: boolean | null
          log_date?: string
          project_id?: string | null
          status?: string
          status_id?: string | null
          submitted_at?: string
          task_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "workflow_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_standups: {
        Row: {
          created_at: string
          date: string
          is_done: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          is_done?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          is_done?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_standups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_resources: {
        Row: {
          assigned_at: string
          goal_id: string
          id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          goal_id: string
          id?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          goal_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_resources_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_resources_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          project_id: string
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          project_id: string
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          project_id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          id: string
          leave_type_id: string | null
          total_days: number
          used_days: number
          user_id: string | null
          year: number
        }
        Insert: {
          id?: string
          leave_type_id?: string | null
          total_days: number
          used_days?: number
          user_id?: string | null
          year: number
        }
        Update: {
          id?: string
          leave_type_id?: string | null
          total_days?: number
          used_days?: number
          user_id?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          admin_comment: string | null
          created_at: string
          days_count: number
          end_date: string
          hours: number | null
          id: string
          leave_type_id: string | null
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string
          user_id: string | null
        }
        Insert: {
          admin_comment?: string | null
          created_at?: string
          days_count: number
          end_date: string
          hours?: number | null
          id?: string
          leave_type_id?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string
          user_id?: string | null
        }
        Update: {
          admin_comment?: string | null
          created_at?: string
          days_count?: number
          end_date?: string
          hours?: number | null
          id?: string
          leave_type_id?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          created_at: string
          days_per_year: number
          id: string
          is_paid: boolean
          name: string
        }
        Insert: {
          created_at?: string
          days_per_year?: number
          id?: string
          is_paid?: boolean
          name: string
        }
        Update: {
          created_at?: string
          days_per_year?: number
          id?: string
          is_paid?: boolean
          name?: string
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          attempted_at: string
          email: string
          id: string
          ip_address: string | null
          success: boolean
        }
        Insert: {
          attempted_at?: string
          email: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Update: {
          attempted_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Relationships: []
      }
      missed_logs: {
        Row: {
          detected_at: string
          id: string
          log_date: string
          user_id: string | null
        }
        Insert: {
          detected_at?: string
          id?: string
          log_date: string
          user_id?: string | null
        }
        Update: {
          detected_at?: string
          id?: string
          log_date?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "missed_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          channel: string
          id: string
          metadata: Json | null
          retry_count: number
          sent_at: string | null
          status: string
          triggered_at: string
          type: string
          user_id: string | null
        }
        Insert: {
          channel?: string
          id?: string
          metadata?: Json | null
          retry_count?: number
          sent_at?: string | null
          status?: string
          triggered_at?: string
          type: string
          user_id?: string | null
        }
        Update: {
          channel?: string
          id?: string
          metadata?: Json | null
          retry_count?: number
          sent_at?: string | null
          status?: string
          triggered_at?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_health_snapshots: {
        Row: {
          health_status: string
          id: string
          logged_hours: number | null
          open_blockers: number | null
          planned_hours: number | null
          project_id: string
          snapshot_date: string
          tasks_complete: number | null
          tasks_overdue: number | null
          tasks_total: number | null
        }
        Insert: {
          health_status: string
          id?: string
          logged_hours?: number | null
          open_blockers?: number | null
          planned_hours?: number | null
          project_id: string
          snapshot_date: string
          tasks_complete?: number | null
          tasks_overdue?: number | null
          tasks_total?: number | null
        }
        Update: {
          health_status?: string
          id?: string
          logged_hours?: number | null
          open_blockers?: number | null
          planned_hours?: number | null
          project_id?: string
          snapshot_date?: string
          tasks_complete?: number | null
          tasks_overdue?: number | null
          tasks_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_health_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          assigned_at: string
          id: string
          notified: boolean | null
          project_id: string | null
          project_role_id: string | null
          removed_at: string | null
          user_id: string | null
        }
        Insert: {
          assigned_at?: string
          id?: string
          notified?: boolean | null
          project_id?: string | null
          project_role_id?: string | null
          removed_at?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_at?: string
          id?: string
          notified?: boolean | null
          project_id?: string | null
          project_role_id?: string | null
          removed_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_role_id_fkey"
            columns: ["project_role_id"]
            isOneToOne: false
            referencedRelation: "project_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_phases: {
        Row: {
          created_at: string
          due_date: string | null
          id: string
          project_id: string
          sort_order: number | null
          title: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          project_id: string
          sort_order?: number | null
          title: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          project_id?: string
          sort_order?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_roles: {
        Row: {
          created_at: string
          id: string
          name: string
          permissions: Json
          project_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          permissions?: Json
          project_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          permissions?: Json
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_status_updates: {
        Row: {
          author_id: string | null
          author_type: string
          created_at: string
          id: string
          project_id: string
          summary: string
          visible_to_client: boolean
        }
        Insert: {
          author_id?: string | null
          author_type?: string
          created_at?: string
          id?: string
          project_id: string
          summary: string
          visible_to_client?: boolean
        }
        Update: {
          author_id?: string | null
          author_type?: string
          created_at?: string
          id?: string
          project_id?: string
          summary?: string
          visible_to_client?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "project_status_updates_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_status_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          document_link: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string
          status: string
          status_note: string | null
          workflow_template_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_link?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date: string
          status?: string
          status_note?: string | null
          workflow_template_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_link?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string
          status?: string
          status_note?: string | null
          workflow_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_workflow_template_id_fkey"
            columns: ["workflow_template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      remote_work_requests: {
        Row: {
          created_at: string | null
          days_count: number
          end_date: string
          id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          days_count?: number
          end_date: string
          id?: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          days_count?: number
          end_date?: string
          id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "remote_work_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remote_work_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sprints: {
        Row: {
          created_at: string
          end_date: string
          id: string
          name: string
          project_id: string
          start_date: string
          status: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          name: string
          project_id: string
          start_date: string
          status?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          project_id?: string
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sprints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_blockers: {
        Row: {
          client_visible: boolean
          description: string
          id: string
          project_id: string
          raised_at: string
          raised_by: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          status_id: string | null
          sprint_id: string | null
          title: string
        }
        Insert: {
          client_visible?: boolean
          description: string
          id?: string
          project_id: string
          raised_at?: string
          raised_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          status_id?: string | null
          title: string
        }
        Update: {
          client_visible?: boolean
          description?: string
          id?: string
          project_id?: string
          raised_at?: string
          raised_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          status_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_blockers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_blockers_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_blockers_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_blockers_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string | null
          author_type: string
          body: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id?: string | null
          author_type?: string
          body: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string | null
          author_type?: string
          body?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_settings: {
        Row: {
          id: string
          project_id: string
          at_risk_variance_percent: number
          delayed_variance_percent: number
          blocker_warning_days: number
          critical_blocker_warning_days: number
          hours_per_day: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          at_risk_variance_percent?: number
          delayed_variance_percent?: number
          blocker_warning_days?: number
          critical_blocker_warning_days?: number
          hours_per_day?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          at_risk_variance_percent?: number
          delayed_variance_percent?: number
          blocker_warning_days?: number
          critical_blocker_warning_days?: number
          hours_per_day?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_settings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      project_settings_kv: {
        Row: {
          created_at: string
          id: string
          key: string
          project_id: string | null
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          project_id?: string | null
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          project_id?: string | null
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "project_settings_kv_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      task_types: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          name: string
          project_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          project_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_types_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      project_health_snapshots: {
      task_dependencies: {
        Row: {
          created_at: string
          created_by: string | null
          dependency_type: string
          depends_on_task_id: string
          id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dependency_type?: string
          depends_on_task_id: string
          id?: string
          task_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dependency_type?: string
          depends_on_task_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      sprints: {
        Row: {
          id: string
          project_id: string
          phase_id: string
          name: string
          start_date: string
          end_date: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          phase_id?: string
          name: string
          start_date: string
          end_date: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          phase_id?: string
          name?: string
          start_date?: string
          end_date?: string
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprints_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      task_schedule_snapshots: {
        Row: {
          earliest_finish: string | null
          earliest_start: string | null
          id: string
          is_critical: boolean | null
          latest_finish: string | null
          latest_start: string | null
          slack_days: number | null
          snapshot_date: string
          task_id: string
        }
        Insert: {
          earliest_finish?: string | null
          earliest_start?: string | null
          id?: string
          is_critical?: boolean | null
          latest_finish?: string | null
          latest_start?: string | null
          slack_days?: number | null
          snapshot_date: string
          task_id: string
        }
        Update: {
          earliest_finish?: string | null
          earliest_start?: string | null
          id?: string
          is_critical?: boolean | null
          latest_finish?: string | null
          latest_start?: string | null
          slack_days?: number | null
          snapshot_date?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_schedule_snapshots_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_status_history: {
        Row: {
          assigned_to_at_change: string | null
          changed_at: string
          changed_by: string | null
          changed_by_type: string
          from_status_id: string | null
          id: string
          task_id: string
          to_status_id: string
        }
        Insert: {
          assigned_to_at_change?: string | null
          changed_at?: string
          changed_by?: string | null
          changed_by_type: string
          from_status_id?: string | null
          id?: string
          task_id: string
          to_status_id: string
        }
        Update: {
          assigned_to_at_change?: string | null
          changed_at?: string
          changed_by?: string | null
          changed_by_type?: string
          from_status_id?: string | null
          id?: string
          task_id?: string
          to_status_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_status_history_from_status_id_fkey"
            columns: ["from_status_id"]
            isOneToOne: false
            referencedRelation: "workflow_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_status_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_status_history_to_status_id_fkey"
            columns: ["to_status_id"]
            isOneToOne: false
            referencedRelation: "workflow_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_status_history_assigned_to_at_change_fkey"
            columns: ["assigned_to_at_change"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          client_visible: boolean
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          goal_id: string | null
          id: string
          is_flagged: boolean | null
          phase_id: string | null
          priority: string
          project_id: string
          sprint_id: string | null
          status: string
          status_id: string | null
          title: string
        }
        Insert: {
          assigned_to?: string | null
          client_visible?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          goal_id?: string | null
          id?: string
          is_flagged?: boolean | null
          phase_id?: string | null
          priority: string
          project_id: string
          sprint_id?: string | null
          status?: string
          status_id?: string | null
          title: string
        }
        Update: {
          assigned_to?: string | null
          client_visible?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          goal_id?: string | null
          id?: string
          is_flagged?: boolean | null
          phase_id?: string | null
          priority?: string
          project_id?: string
          sprint_id?: string | null
          status?: string
          status_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "workflow_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          department: string
          designation: string
          email: string
          employment_type: string
          full_name: string
          has_custom_shift: boolean
          id: string
          is_night_shift: boolean
          is_on_leave: boolean
          is_on_leave_from: string | null
          is_on_leave_to: string | null
          is_oversight: boolean
          join_date: string
          log_edit_days: number | null
          must_change_password: boolean
          overtime_enabled: boolean | null
          phone: string | null
          reminder_offset_minutes: number
          remote_access: boolean
          remote_access_bulk: boolean | null
          remote_access_from: string | null
          remote_access_to: string | null
          remote_site_access: boolean
          role: string
          shift_end: string
          shift_start: string
          status: string
          working_days: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          department: string
          designation: string
          email: string
          employment_type: string
          full_name: string
          has_custom_shift?: boolean
          id: string
          is_night_shift?: boolean
          is_on_leave?: boolean
          is_on_leave_from?: string | null
          is_on_leave_to?: string | null
          is_oversight?: boolean
          join_date: string
          log_edit_days?: number | null
          must_change_password?: boolean
          overtime_enabled?: boolean | null
          phone?: string | null
          reminder_offset_minutes?: number
          remote_access?: boolean
          remote_access_bulk?: boolean | null
          remote_access_from?: string | null
          remote_access_to?: string | null
          remote_site_access?: boolean
          role?: string
          shift_end?: string
          shift_start?: string
          status?: string
          working_days?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          designation?: string
          email?: string
          employment_type?: string
          full_name?: string
          has_custom_shift?: boolean
          id?: string
          is_night_shift?: boolean
          is_on_leave?: boolean
          is_on_leave_from?: string | null
          is_on_leave_to?: string | null
          is_oversight?: boolean
          join_date?: string
          log_edit_days?: number | null
          must_change_password?: boolean
          overtime_enabled?: boolean | null
          phone?: string | null
          reminder_offset_minutes?: number
          remote_access?: boolean
          remote_access_bulk?: boolean | null
          remote_access_from?: string | null
          remote_access_to?: string | null
          remote_site_access?: boolean
          role?: string
          shift_end?: string
          shift_start?: string
          status?: string
          working_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_statuses: {
        Row: {
          category: string
          color: string
          id: string
          is_initial: boolean | null
          name: string
          sort_order: number | null
          workflow_template_id: string
        }
        Insert: {
          category: string
          color?: string
          id?: string
          is_initial?: boolean | null
          name: string
          sort_order?: number | null
          workflow_template_id: string
        }
        Update: {
          category?: string
          color?: string
          id?: string
          is_initial?: boolean | null
          name?: string
          sort_order?: number | null
          workflow_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_statuses_workflow_template_id_fkey"
            columns: ["workflow_template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_transitions: {
        Row: {
          from_status_id: string | null
          id: string
          to_status_id: string
          workflow_template_id: string
        }
        Insert: {
          from_status_id?: string | null
          id?: string
          to_status_id: string
          workflow_template_id: string
        }
        Update: {
          from_status_id?: string | null
          id?: string
          to_status_id?: string
          workflow_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_transitions_from_status_id_fkey"
            columns: ["from_status_id"]
            isOneToOne: false
            referencedRelation: "workflow_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_to_status_id_fkey"
            columns: ["to_status_id"]
            isOneToOne: false
            referencedRelation: "workflow_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_workflow_template_id_fkey"
            columns: ["workflow_template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_remote_access: { Args: never; Returns: undefined }
      compute_all_critical_paths: { Args: never; Returns: undefined }
      compute_all_project_health: { Args: never; Returns: undefined }
      compute_critical_path: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      compute_project_health: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      get_my_role: { Args: never; Returns: string }
      get_project_setting: {
        Args: { p_project_id: string | null; p_key: string; p_default?: Json }
        Returns: Json
      }
      is_project_member: { Args: { p_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
