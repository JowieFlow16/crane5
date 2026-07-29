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
      ai_plans: {
        Row: {
          created_at: string
          daily_images: number
          daily_requests: number
          id: string
          name: string
          sort_order: number
          unlimited: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_images?: number
          daily_requests?: number
          id: string
          name: string
          sort_order?: number
          unlimited?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_images?: number
          daily_requests?: number
          id?: string
          name?: string
          sort_order?: number
          unlimited?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          created_at: string
          failed_requests: number
          images_today: number
          last_request_at: string | null
          last_reset_date: string
          requests_today: number
          successful_requests: number
          total_requests: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          failed_requests?: number
          images_today?: number
          last_request_at?: string | null
          last_reset_date?: string
          requests_today?: number
          successful_requests?: number
          total_requests?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          failed_requests?: number
          images_today?: number
          last_request_at?: string | null
          last_reset_date?: string
          requests_today?: number
          successful_requests?: number
          total_requests?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          content: string
          created_at: string
          id: string
          kind: string
          subject: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          kind?: string
          subject?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          kind?: string
          subject?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chats: {
        Row: {
          created_at: string
          id: string
          subject: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          subject?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          subject?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          hi_avatar: string | null
          hi_name: string | null
          hi_role: string
          id: string
          last_at: string
          last_message: string | null
          last_sender: string | null
          lo_avatar: string | null
          lo_name: string | null
          lo_role: string
          user_hi: string
          user_lo: string
        }
        Insert: {
          created_at?: string
          hi_avatar?: string | null
          hi_name?: string | null
          hi_role?: string
          id?: string
          last_at?: string
          last_message?: string | null
          last_sender?: string | null
          lo_avatar?: string | null
          lo_name?: string | null
          lo_role?: string
          user_hi: string
          user_lo: string
        }
        Update: {
          created_at?: string
          hi_avatar?: string | null
          hi_name?: string | null
          hi_role?: string
          id?: string
          last_at?: string
          last_message?: string | null
          last_sender?: string | null
          lo_avatar?: string | null
          lo_name?: string | null
          lo_role?: string
          user_hi?: string
          user_lo?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read: boolean
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          class_level: Database["public"]["Enums"]["class_level"] | null
          content_text: string | null
          created_at: string
          doc_type: string
          file_size: number | null
          id: string
          name: string
          storage_path: string
          subject: string | null
          uploaded_by: string | null
        }
        Insert: {
          class_level?: Database["public"]["Enums"]["class_level"] | null
          content_text?: string | null
          created_at?: string
          doc_type?: string
          file_size?: number | null
          id?: string
          name: string
          storage_path: string
          subject?: string | null
          uploaded_by?: string | null
        }
        Update: {
          class_level?: Database["public"]["Enums"]["class_level"] | null
          content_text?: string | null
          created_at?: string
          doc_type?: string
          file_size?: number | null
          id?: string
          name?: string
          storage_path?: string
          subject?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      flashcards: {
        Row: {
          back: string
          created_at: string
          due_date: string
          ease: number
          front: string
          id: string
          interval_days: number
          reps: number
          subject: string | null
          topic: string | null
          user_id: string
        }
        Insert: {
          back: string
          created_at?: string
          due_date?: string
          ease?: number
          front: string
          id?: string
          interval_days?: number
          reps?: number
          subject?: string | null
          topic?: string | null
          user_id: string
        }
        Update: {
          back?: string
          created_at?: string
          due_date?: string
          ease?: number
          front?: string
          id?: string
          interval_days?: number
          reps?: number
          subject?: string | null
          topic?: string | null
          user_id?: string
        }
        Relationships: []
      }
      leaderboard: {
        Row: {
          avatar_url: string | null
          class_level: string | null
          current_streak: number
          full_name: string | null
          level: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          class_level?: string | null
          current_streak?: number
          full_name?: string | null
          level?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          class_level?: string | null
          current_streak?: number
          full_name?: string | null
          level?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_avatar: string | null
          author_name: string | null
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          author_avatar?: string | null
          author_name?: string | null
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          author_avatar?: string | null
          author_name?: string | null
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_avatar: string | null
          author_class: string | null
          author_name: string | null
          comments_count: number
          content: string
          created_at: string
          id: string
          image_url: string | null
          kind: string
          likes_count: number
          subject: string | null
          user_id: string
        }
        Insert: {
          author_avatar?: string | null
          author_class?: string | null
          author_name?: string | null
          comments_count?: number
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          kind?: string
          likes_count?: number
          subject?: string | null
          user_id: string
        }
        Update: {
          author_avatar?: string | null
          author_class?: string | null
          author_name?: string | null
          comments_count?: number
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          kind?: string
          likes_count?: number
          subject?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          class_level: Database["public"]["Enums"]["class_level"] | null
          created_at: string
          email: string | null
          favorite_subjects: string[]
          full_name: string | null
          id: string
          learning_goal: string | null
          school: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          class_level?: Database["public"]["Enums"]["class_level"] | null
          created_at?: string
          email?: string | null
          favorite_subjects?: string[]
          full_name?: string | null
          id: string
          learning_goal?: string | null
          school?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          class_level?: Database["public"]["Enums"]["class_level"] | null
          created_at?: string
          email?: string | null
          favorite_subjects?: string[]
          full_name?: string | null
          id?: string
          learning_goal?: string | null
          school?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      progress: {
        Row: {
          attempts: number
          id: string
          last_studied: string
          mastery: number
          subject: string
          topic: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          id?: string
          last_studied?: string
          mastery?: number
          subject: string
          topic?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          id?: string
          last_studied?: string
          mastery?: number
          subject?: string
          topic?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quiz_results: {
        Row: {
          answers: Json
          created_at: string
          id: string
          quiz_id: string | null
          score: number
          subject: string | null
          topic: string | null
          total: number
          user_id: string
          weak_areas: string[] | null
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          quiz_id?: string | null
          score?: number
          subject?: string | null
          topic?: string | null
          total?: number
          user_id: string
          weak_areas?: string[] | null
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          quiz_id?: string | null
          score?: number
          subject?: string | null
          topic?: string | null
          total?: number
          user_id?: string
          weak_areas?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_results_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          difficulty: string
          id: string
          questions: Json
          quiz_type: string
          subject: string
          topic: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty?: string
          id?: string
          questions?: Json
          quiz_type?: string
          subject: string
          topic?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty?: string
          id?: string
          questions?: Json
          quiz_type?: string
          subject?: string
          topic?: string | null
          user_id?: string
        }
        Relationships: []
      }
      study_tasks: {
        Row: {
          created_at: string
          done: boolean
          due_date: string | null
          id: string
          subject: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          subject?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          subject?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      teacher_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          class_levels: string[]
          contact_note: string | null
          created_at: string
          experience_years: number
          full_name: string | null
          headline: string | null
          id: string
          rating_avg: number
          school: string | null
          status: string
          students_helped: number
          subjects: string[]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          class_levels?: string[]
          contact_note?: string | null
          created_at?: string
          experience_years?: number
          full_name?: string | null
          headline?: string | null
          id: string
          rating_avg?: number
          school?: string | null
          status?: string
          students_helped?: number
          subjects?: string[]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          class_levels?: string[]
          contact_note?: string | null
          created_at?: string
          experience_years?: number
          full_name?: string | null
          headline?: string | null
          id?: string
          rating_avg?: number
          school?: string | null
          status?: string
          students_helped?: number
          subjects?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          class_level: Database["public"]["Enums"]["class_level"] | null
          created_at: string
          id: string
          name: string
          subject_id: string
        }
        Insert: {
          class_level?: Database["public"]["Enums"]["class_level"] | null
          created_at?: string
          id?: string
          name: string
          subject_id: string
        }
        Update: {
          class_level?: Database["public"]["Enums"]["class_level"] | null
          created_at?: string
          id?: string
          name?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ai_plans: {
        Row: {
          created_at: string
          note: string | null
          plan_id: string
          unlimited: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          note?: string | null
          plan_id: string
          unlimited?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          note?: string | null
          plan_id?: string
          unlimited?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_ai_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "ai_plans"
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
      user_stats: {
        Row: {
          created_at: string
          current_streak: number
          last_active: string | null
          level: number
          longest_streak: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          created_at?: string
          current_streak?: number
          last_active?: string | null
          level?: number
          longest_streak?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          created_at?: string
          current_streak?: number
          last_active?: string | null
          level?: number
          longest_streak?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ai_effective_limits: {
        Args: { p_user_id: string }
        Returns: {
          daily_images: number
          daily_requests: number
          plan_id: string
          plan_name: string
          unlimited: boolean
        }[]
      }
      ai_usage_snapshot: { Args: { p_user_id: string }; Returns: Json }
      award_xp: {
        Args: { p_amount: number }
        Returns: {
          created_at: string
          current_streak: number
          last_active: string | null
          level: number
          longest_streak: number
          updated_at: string
          user_id: string
          xp: number
        }
        SetofOptions: {
          from: "*"
          to: "user_stats"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consume_ai_quota: {
        Args: { p_kind?: string; p_user_id: string }
        Returns: Json
      }
      record_ai_result: {
        Args: { p_success: boolean; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "student" | "teacher" | "parent" | "admin"
      class_level: "S1" | "S2" | "S3" | "S4" | "S5" | "S6"
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
    Enums: {
      app_role: ["student", "teacher", "parent", "admin"],
      class_level: ["S1", "S2", "S3", "S4", "S5", "S6"],
    },
  },
} as const
