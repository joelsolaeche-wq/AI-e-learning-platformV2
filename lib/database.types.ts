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
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_sessions: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_sessions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_courses: {
        Row: {
          cohort_id: string
          course_id: string
          created_at: string
        }
        Insert: {
          cohort_id: string
          course_id: string
          created_at?: string
        }
        Update: {
          cohort_id?: string
          course_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_courses_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_invitations: {
        Row: {
          code: string
          cohort_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          max_uses: number | null
          uses_count: number
        }
        Insert: {
          code: string
          cohort_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          uses_count?: number
        }
        Update: {
          code?: string
          cohort_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "cohort_invitations_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_waitlist: {
        Row: {
          cohort_id: string
          id: string
          requested_at: string
          user_id: string
        }
        Insert: {
          cohort_id: string
          id?: string
          requested_at?: string
          user_id: string
        }
        Update: {
          cohort_id?: string
          id?: string
          requested_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_waitlist_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      cohorts: {
        Row: {
          company_id: string | null
          course_id: string | null
          created_at: string
          ends_at: string | null
          id: string
          image_url: string | null
          max_seats: number
          modality: string | null
          notes: string | null
          starts_at: string
          status: string
          title: string
        }
        Insert: {
          company_id?: string | null
          course_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          max_seats?: number
          modality?: string | null
          notes?: string | null
          starts_at: string
          status?: string
          title: string
        }
        Update: {
          company_id?: string | null
          course_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          max_seats?: number
          modality?: string | null
          notes?: string | null
          starts_at?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohorts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohorts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_companies: {
        Row: {
          company_id: string
          course_id: string
        }
        Insert: {
          company_id: string
          course_id: string
        }
        Update: {
          company_id?: string
          course_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_companies_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          org_id: string | null
          slug: string
          status: string
          thumbnail_url: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          org_id?: string | null
          slug: string
          status?: string
          thumbnail_url?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          org_id?: string | null
          slug?: string
          status?: string
          thumbnail_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          cohort_id: string
          enrolled_at: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          cohort_id: string
          enrolled_at?: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          cohort_id?: string
          enrolled_at?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_rubric_items: {
        Row: {
          created_at: string
          criterion: string
          description: string
          id: string
          lab_id: string
          position: number
          weight: number
        }
        Insert: {
          created_at?: string
          criterion: string
          description?: string
          id?: string
          lab_id: string
          position: number
          weight?: number
        }
        Update: {
          created_at?: string
          criterion?: string
          description?: string
          id?: string
          lab_id?: string
          position?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "lab_rubric_items_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_submission_scores: {
        Row: {
          created_at: string
          feedback_md: string
          id: string
          rubric_item_id: string
          stars: number
          submission_id: string
        }
        Insert: {
          created_at?: string
          feedback_md?: string
          id?: string
          rubric_item_id: string
          stars: number
          submission_id: string
        }
        Update: {
          created_at?: string
          feedback_md?: string
          id?: string
          rubric_item_id?: string
          stars?: number
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_submission_scores_rubric_item_id_fkey"
            columns: ["rubric_item_id"]
            isOneToOne: false
            referencedRelation: "lab_rubric_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_submission_scores_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "lab_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_submissions: {
        Row: {
          cohort_id: string | null
          error_message: string | null
          github_url: string | null
          id: string
          lab_id: string
          max_score: number
          overall_stars: number | null
          pdf_path: string | null
          scored_at: string | null
          status: string
          submission_type: string
          submitted_at: string
          summary_md: string | null
          text_content: string | null
          total_score: number
          user_id: string
        }
        Insert: {
          cohort_id?: string | null
          error_message?: string | null
          github_url?: string | null
          id?: string
          lab_id: string
          max_score?: number
          overall_stars?: number | null
          pdf_path?: string | null
          scored_at?: string | null
          status?: string
          submission_type?: string
          submitted_at?: string
          summary_md?: string | null
          text_content?: string | null
          total_score?: number
          user_id: string
        }
        Update: {
          cohort_id?: string | null
          error_message?: string | null
          github_url?: string | null
          id?: string
          lab_id?: string
          max_score?: number
          overall_stars?: number | null
          pdf_path?: string | null
          scored_at?: string | null
          status?: string
          submission_type?: string
          submitted_at?: string
          summary_md?: string | null
          text_content?: string | null
          total_score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_submissions_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_submissions_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "labs"
            referencedColumns: ["id"]
          },
        ]
      }
      labs: {
        Row: {
          brief_md: string
          created_at: string
          id: string
          lesson_id: string
          title: string
          updated_at: string
        }
        Insert: {
          brief_md?: string
          created_at?: string
          id?: string
          lesson_id: string
          title: string
          updated_at?: string
        }
        Update: {
          brief_md?: string
          created_at?: string
          id?: string
          lesson_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "labs_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          id: string
          last_position: number
          lesson_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          last_position?: number
          lesson_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          last_position?: number
          lesson_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content_type: string
          created_at: string
          document_url: string | null
          duration_seconds: number | null
          id: string
          module_id: string
          mux_playback_id: string | null
          notebook_url: string | null
          position: number
          slides_url: string | null
          title: string
          transcript: string | null
          transcript_segments: Json | null
          video_source: string
          video_url: string | null
          youtube_id: string | null
        }
        Insert: {
          content_type?: string
          created_at?: string
          document_url?: string | null
          duration_seconds?: number | null
          id?: string
          module_id: string
          mux_playback_id?: string | null
          notebook_url?: string | null
          position: number
          slides_url?: string | null
          title: string
          transcript?: string | null
          transcript_segments?: Json | null
          video_source?: string
          video_url?: string | null
          youtube_id?: string | null
        }
        Update: {
          content_type?: string
          created_at?: string
          document_url?: string | null
          duration_seconds?: number | null
          id?: string
          module_id?: string
          mux_playback_id?: string | null
          notebook_url?: string | null
          position?: number
          slides_url?: string | null
          title?: string
          transcript?: string | null
          transcript_segments?: Json | null
          video_source?: string
          video_url?: string | null
          youtube_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          course_id: string
          created_at: string
          id: string
          position: number
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          position: number
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          logo_url: string | null
          name: string
          slug: string
          website: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          website?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          website?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          org_id: string | null
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          org_id?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          org_id?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_org"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          answers: Json
          cohort_id: string | null
          id: string
          lesson_id: string
          max_score: number
          score: number
          submitted_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          cohort_id?: string | null
          id?: string
          lesson_id: string
          max_score?: number
          score?: number
          submitted_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          cohort_id?: string | null
          id?: string
          lesson_id?: string
          max_score?: number
          score?: number
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_definitions: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          questions: Json
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          questions?: Json
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          questions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "quiz_definitions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_cohort_progress: {
        Row: {
          cohort_id: string | null
          completed_lessons: number | null
          course_id: string | null
          pct: number | null
          total_lessons: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cohort_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_my_active_cohort_ids: { Args: never; Returns: string[] }
      is_admin: { Args: never; Returns: boolean }
      is_company_owner_of: { Args: { company: string }; Returns: boolean }
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
  public: {
    Enums: {},
  },
} as const
