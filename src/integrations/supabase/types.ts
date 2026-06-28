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
      [_ in never]: never
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
