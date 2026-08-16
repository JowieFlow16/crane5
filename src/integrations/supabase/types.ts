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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ai_budgets: {
        Row: {
          alert_thresholds: number[]
          daily_limit: number
          enforce: boolean
          id: string
          monthly_limit: number
          scope: string
          updated_at: string
        }
        Insert: {
          alert_thresholds?: number[]
          daily_limit?: number
          enforce?: boolean
          id: string
          monthly_limit?: number
          scope?: string
          updated_at?: string
        }
        Update: {
          alert_thresholds?: number[]
          daily_limit?: number
          enforce?: boolean
          id?: string
          monthly_limit?: number
          scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_cache_entries: {
        Row: {
          capability: string
          class_level: string | null
          created_at: string
          expires_at: string
          hits: number
          id: string
          last_hit_at: string | null
          prompt_preview: string | null
          subject: string | null
          value: Json
        }
        Insert: {
          capability?: string
          class_level?: string | null
          created_at?: string
          expires_at: string
          hits?: number
          id: string
          last_hit_at?: string | null
          prompt_preview?: string | null
          subject?: string | null
          value: Json
        }
        Update: {
          capability?: string
          class_level?: string | null
          created_at?: string
          expires_at?: string
          hits?: number
          id?: string
          last_hit_at?: string | null
          prompt_preview?: string | null
          subject?: string | null
          value?: Json
        }
        Relationships: []
      }
      ai_key_state: {
        Row: {
          key_index: number
          parked_until: string | null
          provider_id: string
          reason: string | null
          updated_at: string
          uses: number
        }
        Insert: {
          key_index: number
          parked_until?: string | null
          provider_id: string
          reason?: string | null
          updated_at?: string
          uses?: number
        }
        Update: {
          key_index?: number
          parked_until?: string | null
          provider_id?: string
          reason?: string | null
          updated_at?: string
          uses?: number
        }
        Relationships: []
      }
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
      ai_policies: {
        Row: {
          active: boolean
          allow_premium: boolean
          blocks_new_requests: boolean
          description: string | null
          id: string
          max_concurrency: number | null
          name: string
          prefer_cheap: boolean
          quota_multiplier: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          allow_premium?: boolean
          blocks_new_requests?: boolean
          description?: string | null
          id: string
          max_concurrency?: number | null
          name: string
          prefer_cheap?: boolean
          quota_multiplier?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          allow_premium?: boolean
          blocks_new_requests?: boolean
          description?: string | null
          id?: string
          max_concurrency?: number | null
          name?: string
          prefer_cheap?: boolean
          quota_multiplier?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_providers_config: {
        Row: {
          cost_profile: string
          enabled: boolean
          id: string
          label: string
          max_concurrency: number | null
          notes: string | null
          priority: number
          updated_at: string
        }
        Insert: {
          cost_profile?: string
          enabled?: boolean
          id: string
          label: string
          max_concurrency?: number | null
          notes?: string | null
          priority?: number
          updated_at?: string
        }
        Update: {
          cost_profile?: string
          enabled?: boolean
          id?: string
          label?: string
          max_concurrency?: number | null
          notes?: string | null
          priority?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_queue_jobs: {
        Row: {
          attempts: number
          correlation_id: string | null
          created_at: string
          dedupe_key: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          kind: string
          locked_at: string | null
          max_attempts: number
          payload: Json
          priority: number
          result: Json | null
          run_after: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          correlation_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          kind: string
          locked_at?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          result?: Json | null
          run_after?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          correlation_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          locked_at?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          result?: Json | null
          run_after?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_request_log: {
        Row: {
          cache_hit: boolean
          cached_tokens: number
          conversation_id: string | null
          correlation_id: string | null
          created_at: string
          error_message: string | null
          estimated_cost: number
          id: string
          input_tokens: number
          latency_ms: number
          model: string
          output_tokens: number
          provider: string
          queue_ms: number
          reasoning_tokens: number
          retry_count: number
          status: string
          subject: string | null
          task_type: string
          user_id: string | null
        }
        Insert: {
          cache_hit?: boolean
          cached_tokens?: number
          conversation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          error_message?: string | null
          estimated_cost?: number
          id?: string
          input_tokens?: number
          latency_ms?: number
          model: string
          output_tokens?: number
          provider: string
          queue_ms?: number
          reasoning_tokens?: number
          retry_count?: number
          status?: string
          subject?: string | null
          task_type: string
          user_id?: string | null
        }
        Update: {
          cache_hit?: boolean
          cached_tokens?: number
          conversation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          error_message?: string | null
          estimated_cost?: number
          id?: string
          input_tokens?: number
          latency_ms?: number
          model?: string
          output_tokens?: number
          provider?: string
          queue_ms?: number
          reasoning_tokens?: number
          retry_count?: number
          status?: string
          subject?: string | null
          task_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          bonus_requests: number
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
          bonus_requests?: number
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
          bonus_requests?: number
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
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: string
          meta: Json
          target: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          target?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          target?: string | null
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
      daily_reward_claims: {
        Row: {
          amount: number
          claim_date: string
          created_at: string
          id: string
          kind: string
          meta: Json
          user_id: string
        }
        Insert: {
          amount?: number
          claim_date?: string
          created_at?: string
          id?: string
          kind: string
          meta?: Json
          user_id: string
        }
        Update: {
          amount?: number
          claim_date?: string
          created_at?: string
          id?: string
          kind?: string
          meta?: Json
          user_id?: string
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
          last_fetched_at: string | null
          name: string
          source_type: string
          source_url: string | null
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
          last_fetched_at?: string | null
          name: string
          source_type?: string
          source_url?: string | null
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
          last_fetched_at?: string | null
          name?: string
          source_type?: string
          source_url?: string | null
          storage_path?: string
          subject?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          key: string
          label: string
          rollout_percent: number
          updated_at: string
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          key: string
          label: string
          rollout_percent?: number
          updated_at?: string
        }
        Update: {
          description?: string | null
          enabled?: boolean
          key?: string
          label?: string
          rollout_percent?: number
          updated_at?: string
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
          onboarded: boolean
          referral_source: string | null
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
          onboarded?: boolean
          referral_source?: string | null
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
          onboarded?: boolean
          referral_source?: string | null
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
      provider_health: {
        Row: {
          avg_latency_ms: number
          consecutive_failures: number
          disabled_until: string | null
          failure: number
          last_error: string | null
          last_failure_at: string | null
          last_success_at: string | null
          provider_id: string
          success: number
          updated_at: string
        }
        Insert: {
          avg_latency_ms?: number
          consecutive_failures?: number
          disabled_until?: string | null
          failure?: number
          last_error?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          provider_id: string
          success?: number
          updated_at?: string
        }
        Update: {
          avg_latency_ms?: number
          consecutive_failures?: number
          disabled_until?: string | null
          failure?: number
          last_error?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          provider_id?: string
          success?: number
          updated_at?: string
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
      referral_shares: {
        Row: {
          channel: string
          created_at: string
          id: string
          share_date: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          share_date?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          share_date?: string
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
      system_alerts: {
        Row: {
          component: string
          created_at: string
          dedupe_key: string | null
          description: string | null
          id: string
          recommended_action: string | null
          resolved: boolean
          resolved_at: string | null
          severity: string
          title: string
        }
        Insert: {
          component: string
          created_at?: string
          dedupe_key?: string | null
          description?: string | null
          id?: string
          recommended_action?: string | null
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          title: string
        }
        Update: {
          component?: string
          created_at?: string
          dedupe_key?: string | null
          description?: string | null
          id?: string
          recommended_action?: string | null
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          title?: string
        }
        Relationships: []
      }
      system_metrics: {
        Row: {
          created_at: string
          id: string
          meta: Json
          name: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          meta?: Json
          name: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          meta?: Json
          name?: string
          value?: number
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
      timetable_slots: {
        Row: {
          activity: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          reminder_minutes: number
          reminders_on: boolean
          start_time: string
          subject: string
          topic: string | null
          user_id: string
        }
        Insert: {
          activity?: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          reminder_minutes?: number
          reminders_on?: boolean
          start_time: string
          subject: string
          topic?: string | null
          user_id: string
        }
        Update: {
          activity?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          reminder_minutes?: number
          reminders_on?: boolean
          start_time?: string
          subject?: string
          topic?: string | null
          user_id?: string
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
      tournament_entries: {
        Row: {
          avatar_url: string | null
          awarded_credits: number
          class_level: string | null
          created_at: string
          display_name: string | null
          finished_at: string | null
          id: string
          rank: number | null
          score: number
          time_ms: number
          total: number
          tournament_id: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          awarded_credits?: number
          class_level?: string | null
          created_at?: string
          display_name?: string | null
          finished_at?: string | null
          id?: string
          rank?: number | null
          score?: number
          time_ms?: number
          total?: number
          tournament_id: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          awarded_credits?: number
          class_level?: string | null
          created_at?: string
          display_name?: string | null
          finished_at?: string | null
          id?: string
          rank?: number | null
          score?: number
          time_ms?: number
          total?: number
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          class_level: string | null
          created_at: string
          created_by: string | null
          description: string | null
          difficulty: string
          ends_at: string
          finalized_at: string | null
          id: string
          kind: string
          prize_credits: number
          prize_xp: number
          published: boolean
          questions: Json
          seconds_per_question: number
          starts_at: string
          subject: string | null
          title: string
          updated_at: string
          winners_count: number
        }
        Insert: {
          class_level?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: string
          ends_at?: string
          finalized_at?: string | null
          id?: string
          kind?: string
          prize_credits?: number
          prize_xp?: number
          published?: boolean
          questions?: Json
          seconds_per_question?: number
          starts_at?: string
          subject?: string | null
          title: string
          updated_at?: string
          winners_count?: number
        }
        Update: {
          class_level?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: string
          ends_at?: string
          finalized_at?: string | null
          id?: string
          kind?: string
          prize_credits?: number
          prize_xp?: number
          published?: boolean
          questions?: Json
          seconds_per_question?: number
          starts_at?: string
          subject?: string | null
          title?: string
          updated_at?: string
          winners_count?: number
        }
        Relationships: []
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
      add_bonus_requests: {
        Args: { p_amount: number; p_user_id: string }
        Returns: undefined
      }
      add_xp_for: {
        Args: { p_amount: number; p_user_id: string }
        Returns: undefined
      }
      ai_cost_overview: { Args: never; Returns: Json }
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
      claim_top_rank_bonus: { Args: never; Returns: Json }
      consume_ai_quota: {
        Args: { p_kind?: string; p_user_id: string }
        Returns: Json
      }
      finalize_tournament: { Args: { p_tournament_id: string }; Returns: Json }
      record_ai_result: {
        Args: { p_success: boolean; p_user_id: string }
        Returns: undefined
      }
      record_app_share: { Args: { p_channel?: string }; Returns: Json }
      submit_tournament_entry: {
        Args: {
          p_score: number
          p_time_ms: number
          p_total: number
          p_tournament_id: string
        }
        Returns: Json
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
