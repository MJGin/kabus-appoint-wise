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
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          category: Database["public"]["Enums"]["log_category"]
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          category?: Database["public"]["Enums"]["log_category"]
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          category?: Database["public"]["Enums"]["log_category"]
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      appointment_reasons: {
        Row: {
          appointment_id: string
          created_at: string
          reason: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          reason: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reasons_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appt_date: string
          block: Database["public"]["Enums"]["time_block"]
          created_at: string
          decided_at: string | null
          duration_minutes: number | null
          id: string
          lecturer_id: string | null
          listing_id: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          appt_date: string
          block: Database["public"]["Enums"]["time_block"]
          created_at?: string
          decided_at?: string | null
          duration_minutes?: number | null
          id?: string
          lecturer_id?: string | null
          listing_id?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          appt_date?: string
          block?: Database["public"]["Enums"]["time_block"]
          created_at?: string
          decided_at?: string | null
          duration_minutes?: number | null
          id?: string
          lecturer_id?: string | null
          listing_id?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      approved_staff: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      approved_students: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      consent_records: {
        Row: {
          age_confirmed: boolean
          created_at: string
          decision: string
          email: string
          form_version: string
          full_name: string
          id: string
          participant_category: string
          user_id: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      auth_throttle: {
        Row: {
          attempts: number
          id: string
          identifier: string
          locked_until: string | null
          scope: string
          window_started_at: string
        }
        Insert: {
          attempts?: number
          id?: string
          identifier: string
          locked_until?: string | null
          scope: string
          window_started_at?: string
        }
        Update: {
          attempts?: number
          id?: string
          identifier?: string
          locked_until?: string | null
          scope?: string
          window_started_at?: string
        }
        Relationships: []
      }
      error_reports: {
        Row: {
          context: string | null
          created_at: string
          id: string
          message: string
          resolved: boolean
          url: string | null
          user_id: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string
          id?: string
          message: string
          resolved?: boolean
          url?: string | null
          user_id?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string
          id?: string
          message?: string
          resolved?: boolean
          url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      exam_slots: {
        Row: {
          block: Database["public"]["Enums"]["time_block"]
          created_at: string
          exam_date: string
          id: string
          lecturer_id: string
          semester_id: string
          unit_code: string
          unit_name: string | null
          venue: string
        }
        Insert: {
          block: Database["public"]["Enums"]["time_block"]
          created_at?: string
          exam_date: string
          id?: string
          lecturer_id: string
          semester_id: string
          unit_code: string
          unit_name?: string | null
          venue: string
        }
        Update: {
          block?: Database["public"]["Enums"]["time_block"]
          created_at?: string
          exam_date?: string
          id?: string
          lecturer_id?: string
          semester_id?: string
          unit_code?: string
          unit_name?: string | null
          venue?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_slots_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
        ]
      }
      makeup_sessions: {
        Row: {
          block: Database["public"]["Enums"]["time_block"]
          created_at: string
          id: string
          lecturer_id: string
          note: string | null
          session_date: string
        }
        Insert: {
          block: Database["public"]["Enums"]["time_block"]
          created_at?: string
          id?: string
          lecturer_id: string
          note?: string | null
          session_date: string
        }
        Update: {
          block?: Database["public"]["Enums"]["time_block"]
          created_at?: string
          id?: string
          lecturer_id?: string
          note?: string | null
          session_date?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bio: string | null
          created_at: string
          department: string | null
          email: string | null
          full_name: string
          id: string
          office_location: string | null
          photo_url: string | null
          reg_number: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string
          id: string
          office_location?: string | null
          photo_url?: string | null
          reg_number?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string
          id?: string
          office_location?: string | null
          photo_url?: string | null
          reg_number?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      semesters: {
        Row: {
          created_at: string
          end_date: string
          exam_start_date: string
          id: string
          is_active: boolean
          name: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          exam_start_date: string
          id?: string
          is_active?: boolean
          name: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          exam_start_date?: string
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string
        }
        Relationships: []
      }
      staff_listings: {
        Row: {
          bio: string | null
          classes: Json
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          office_location: string | null
          photo_url: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          bio?: string | null
          classes?: Json
          created_at?: string
          department?: string | null
          email: string
          full_name: string
          id?: string
          office_location?: string | null
          photo_url?: string | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          bio?: string | null
          classes?: Json
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          office_location?: string | null
          photo_url?: string | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      timetable_slots: {
        Row: {
          block: Database["public"]["Enums"]["time_block"]
          created_at: string
          day_of_week: number
          id: string
          lecturer_id: string
          semester_id: string
          unit_code: string
          unit_name: string
          year_group: number
        }
        Insert: {
          block: Database["public"]["Enums"]["time_block"]
          created_at?: string
          day_of_week: number
          id?: string
          lecturer_id: string
          semester_id: string
          unit_code: string
          unit_name: string
          year_group: number
        }
        Update: {
          block?: Database["public"]["Enums"]["time_block"]
          created_at?: string
          day_of_week?: number
          id?: string
          lecturer_id?: string
          semester_id?: string
          unit_code?: string
          unit_name?: string
          year_group?: number
        }
        Relationships: [
          {
            foreignKeyName: "timetable_slots_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      record_consent: {
        Args: {
          _age_confirmed: boolean
          _decision: string
          _form_version: string
          _full_name: string
        }
        Returns: string
      }
      book_appointment: {
        Args: {
          _appt_date: string
          _block: Database["public"]["Enums"]["time_block"]
          _lecturer_id: string
          _reason: string
        }
        Returns: string
      }
      book_appointment_slot: {
        Args: {
          _appt_date: string
          _block: Database["public"]["Enums"]["time_block"]
          _duration_minutes: number
          _lecturer_id: string | null
          _listing_id: string | null
          _reason: string
          _start_time: string
        }
        Returns: string
      }
      busy_times: {
        Args: { _lecturer_id?: string | null; _listing_id?: string | null }
        Returns: {
          appt_date: string
          block: Database["public"]["Enums"]["time_block"]
          duration_minutes: number
          start_time: string
        }[]
      }
      cancel_appointment: {
        Args: { _appointment_id: string }
        Returns: undefined
      }
      check_auth_throttle: {
        Args: { _identifier: string; _scope: string }
        Returns: boolean
      }
      consume_action_throttle: {
        Args: {
          _identifier: string
          _maximum: number
          _scope: string
          _window_minutes: number
        }
        Returns: boolean
      }
      current_role_is: {
        Args: { _roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
      decide_appointment: {
        Args: {
          _appointment_id: string
          _decision: Database["public"]["Enums"]["appointment_status"]
          _new_block?: Database["public"]["Enums"]["time_block"]
          _new_date?: string
          _new_duration?: number
          _new_start?: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_chapel: {
        Args: {
          _block: Database["public"]["Enums"]["time_block"]
          _date: string
        }
        Returns: boolean
      }
      lecturer_is_available: {
        Args: {
          _block: Database["public"]["Enums"]["time_block"]
          _date: string
          _lecturer: string
        }
        Returns: boolean
      }
      record_auth_attempt: {
        Args: { _identifier: string; _scope: string; _succeeded: boolean }
        Returns: undefined
      }
      record_auth_failure: {
        Args: {
          _identifier: string
          _max_failures: number
          _scope: string
          _window_minutes: number
        }
        Returns: undefined
      }
      write_log: {
        Args: {
          _action: string
          _category: Database["public"]["Enums"]["log_category"]
          _details: Json
          _entity_id: string
          _entity_type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "student" | "lecturer" | "dean" | "administrator" | "it_support"
      appointment_status: "pending" | "accepted" | "declined" | "cancelled"
      log_category: "operational" | "credential"
      time_block: "block_1" | "block_2" | "block_3"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["student", "lecturer", "dean", "administrator", "it_support"],
      appointment_status: ["pending", "accepted", "declined", "cancelled"],
      log_category: ["operational", "credential"],
      time_block: ["block_1", "block_2", "block_3"],
    },
  },
} as const
