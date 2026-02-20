export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      teams: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      team_members: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          role?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          user_id?: string;
          role?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      campaigns: {
        Row: {
          id: string;
          team_id: string;
          name: string;
          description: string | null;
          status: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          name: string;
          description?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          name?: string;
          description?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaigns_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      keywords: {
        Row: {
          id: string;
          campaign_id: string;
          keyword: string;
          platform: string;
          country: string | null;
          estimated_count: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          keyword: string;
          platform: string;
          country?: string | null;
          estimated_count?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          keyword?: string;
          platform?: string;
          country?: string | null;
          estimated_count?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "keywords_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      tagged_accounts: {
        Row: {
          id: string;
          campaign_id: string;
          account_username: string;
          platform: string;
          estimated_count: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          account_username: string;
          platform: string;
          estimated_count?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          account_username?: string;
          platform?: string;
          estimated_count?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tagged_accounts_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      extraction_jobs: {
        Row: {
          id: string;
          campaign_id: string;
          type: string;
          source_id: string | null;
          platform: string;
          apify_run_id: string | null;
          status: string;
          input_config: Json | null;
          total_extracted: number;
          new_extracted: number;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          type: string;
          source_id?: string | null;
          platform: string;
          apify_run_id?: string | null;
          status?: string;
          input_config?: Json | null;
          total_extracted?: number;
          new_extracted?: number;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          type?: string;
          source_id?: string | null;
          platform?: string;
          apify_run_id?: string | null;
          status?: string;
          input_config?: Json | null;
          total_extracted?: number;
          new_extracted?: number;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "extraction_jobs_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      influencers: {
        Row: {
          id: string;
          platform: string;
          platform_id: string | null;
          username: string | null;
          display_name: string | null;
          profile_url: string | null;
          profile_image_url: string | null;
          email: string | null;
          email_source: string | null;
          bio: string | null;
          follower_count: number | null;
          following_count: number | null;
          post_count: number | null;
          engagement_rate: number | null;
          country: string | null;
          language: string | null;
          extracted_keywords: string[] | null;
          extracted_from_tags: string[] | null;
          raw_data: Json | null;
          last_updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          platform: string;
          platform_id?: string | null;
          username?: string | null;
          display_name?: string | null;
          profile_url?: string | null;
          profile_image_url?: string | null;
          email?: string | null;
          email_source?: string | null;
          bio?: string | null;
          follower_count?: number | null;
          following_count?: number | null;
          post_count?: number | null;
          engagement_rate?: number | null;
          country?: string | null;
          language?: string | null;
          extracted_keywords?: string[] | null;
          extracted_from_tags?: string[] | null;
          raw_data?: Json | null;
          last_updated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          platform?: string;
          platform_id?: string | null;
          username?: string | null;
          display_name?: string | null;
          profile_url?: string | null;
          profile_image_url?: string | null;
          email?: string | null;
          email_source?: string | null;
          bio?: string | null;
          follower_count?: number | null;
          following_count?: number | null;
          post_count?: number | null;
          engagement_rate?: number | null;
          country?: string | null;
          language?: string | null;
          extracted_keywords?: string[] | null;
          extracted_from_tags?: string[] | null;
          raw_data?: Json | null;
          last_updated_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      influencer_links: {
        Row: {
          id: string;
          influencer_id: string;
          url: string;
          scraped: boolean;
          emails_found: string[] | null;
          scraped_at: string | null;
        };
        Insert: {
          id?: string;
          influencer_id: string;
          url: string;
          scraped?: boolean;
          emails_found?: string[] | null;
          scraped_at?: string | null;
        };
        Update: {
          id?: string;
          influencer_id?: string;
          url?: string;
          scraped?: boolean;
          emails_found?: string[] | null;
          scraped_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "influencer_links_influencer_id_fkey";
            columns: ["influencer_id"];
            isOneToOne: false;
            referencedRelation: "influencers";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_influencers: {
        Row: {
          id: string;
          campaign_id: string;
          influencer_id: string;
          status: string;
          agreed_date: string | null;
          visit_date: string | null;
          upload_deadline: string | null;
          actual_upload_date: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          influencer_id: string;
          status?: string;
          agreed_date?: string | null;
          visit_date?: string | null;
          upload_deadline?: string | null;
          actual_upload_date?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          influencer_id?: string;
          status?: string;
          agreed_date?: string | null;
          visit_date?: string | null;
          upload_deadline?: string | null;
          actual_upload_date?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_influencers_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_influencers_influencer_id_fkey";
            columns: ["influencer_id"];
            isOneToOne: false;
            referencedRelation: "influencers";
            referencedColumns: ["id"];
          },
        ];
      };
      email_templates: {
        Row: {
          id: string;
          campaign_id: string;
          round_number: number;
          subject: string;
          body_html: string;
          sender_name: string | null;
          sender_email: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          round_number?: number;
          subject: string;
          body_html: string;
          sender_name?: string | null;
          sender_email?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          round_number?: number;
          subject?: string;
          body_html?: string;
          sender_name?: string | null;
          sender_email?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_templates_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      email_logs: {
        Row: {
          id: string;
          campaign_id: string;
          influencer_id: string;
          template_id: string | null;
          round_number: number;
          resend_message_id: string | null;
          status: string;
          sent_at: string | null;
          opened_at: string | null;
          clicked_at: string | null;
          replied_at: string | null;
          cta_clicked: boolean;
          cta_clicked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          influencer_id: string;
          template_id?: string | null;
          round_number?: number;
          resend_message_id?: string | null;
          status?: string;
          sent_at?: string | null;
          opened_at?: string | null;
          clicked_at?: string | null;
          replied_at?: string | null;
          cta_clicked?: boolean;
          cta_clicked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          influencer_id?: string;
          template_id?: string | null;
          round_number?: number;
          resend_message_id?: string | null;
          status?: string;
          sent_at?: string | null;
          opened_at?: string | null;
          clicked_at?: string | null;
          replied_at?: string | null;
          cta_clicked?: boolean;
          cta_clicked_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_logs_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_logs_influencer_id_fkey";
            columns: ["influencer_id"];
            isOneToOne: false;
            referencedRelation: "influencers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_logs_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "email_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      email_threads: {
        Row: {
          id: string;
          campaign_id: string;
          influencer_id: string;
          subject: string | null;
          last_message_at: string | null;
          unread: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          influencer_id: string;
          subject?: string | null;
          last_message_at?: string | null;
          unread?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          influencer_id?: string;
          subject?: string | null;
          last_message_at?: string | null;
          unread?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_threads_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_threads_influencer_id_fkey";
            columns: ["influencer_id"];
            isOneToOne: false;
            referencedRelation: "influencers";
            referencedColumns: ["id"];
          },
        ];
      };
      email_messages: {
        Row: {
          id: string;
          thread_id: string;
          direction: string;
          from_email: string | null;
          to_email: string | null;
          subject: string | null;
          body_html: string | null;
          body_text: string | null;
          resend_message_id: string | null;
          received_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          direction: string;
          from_email?: string | null;
          to_email?: string | null;
          subject?: string | null;
          body_html?: string | null;
          body_text?: string | null;
          resend_message_id?: string | null;
          received_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          direction?: string;
          from_email?: string | null;
          to_email?: string | null;
          subject?: string | null;
          body_html?: string | null;
          body_text?: string | null;
          resend_message_id?: string | null;
          received_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "email_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_sns_accounts: {
        Row: {
          id: string;
          campaign_id: string;
          platform: string;
          account_name: string | null;
          account_id: string | null;
          access_token: string | null;
          refresh_token: string | null;
          api_key: string | null;
          api_secret: string | null;
          extra_config: Json | null;
          connected: boolean;
          connected_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          platform: string;
          account_name?: string | null;
          account_id?: string | null;
          access_token?: string | null;
          refresh_token?: string | null;
          api_key?: string | null;
          api_secret?: string | null;
          extra_config?: Json | null;
          connected?: boolean;
          connected_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          platform?: string;
          account_name?: string | null;
          account_id?: string | null;
          access_token?: string | null;
          refresh_token?: string | null;
          api_key?: string | null;
          api_secret?: string | null;
          extra_config?: Json | null;
          connected?: boolean;
          connected_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_sns_accounts_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      influencer_contents: {
        Row: {
          id: string;
          campaign_id: string;
          influencer_id: string;
          original_platform: string;
          original_url: string;
          original_content_id: string | null;
          video_storage_path: string | null;
          video_downloaded: boolean;
          caption: string | null;
          uploaded_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          influencer_id: string;
          original_platform: string;
          original_url: string;
          original_content_id?: string | null;
          video_storage_path?: string | null;
          video_downloaded?: boolean;
          caption?: string | null;
          uploaded_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          influencer_id?: string;
          original_platform?: string;
          original_url?: string;
          original_content_id?: string | null;
          video_storage_path?: string | null;
          video_downloaded?: boolean;
          caption?: string | null;
          uploaded_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "influencer_contents_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "influencer_contents_influencer_id_fkey";
            columns: ["influencer_id"];
            isOneToOne: false;
            referencedRelation: "influencers";
            referencedColumns: ["id"];
          },
        ];
      };
      multi_channel_uploads: {
        Row: {
          id: string;
          content_id: string;
          campaign_id: string;
          target_platform: string;
          sns_account_id: string | null;
          caption: string | null;
          title: string | null;
          tags: string[] | null;
          status: string;
          platform_post_id: string | null;
          platform_post_url: string | null;
          published_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          content_id: string;
          campaign_id: string;
          target_platform: string;
          sns_account_id?: string | null;
          caption?: string | null;
          title?: string | null;
          tags?: string[] | null;
          status?: string;
          platform_post_id?: string | null;
          platform_post_url?: string | null;
          published_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          content_id?: string;
          campaign_id?: string;
          target_platform?: string;
          sns_account_id?: string | null;
          caption?: string | null;
          title?: string | null;
          tags?: string[] | null;
          status?: string;
          platform_post_id?: string | null;
          platform_post_url?: string | null;
          published_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "multi_channel_uploads_content_id_fkey";
            columns: ["content_id"];
            isOneToOne: false;
            referencedRelation: "influencer_contents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "multi_channel_uploads_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "multi_channel_uploads_sns_account_id_fkey";
            columns: ["sns_account_id"];
            isOneToOne: false;
            referencedRelation: "campaign_sns_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      content_metrics: {
        Row: {
          id: string;
          upload_id: string;
          views: number;
          likes: number;
          comments: number;
          shares: number;
          engagement_rate: number | null;
          tracked_at: string;
        };
        Insert: {
          id?: string;
          upload_id: string;
          views?: number;
          likes?: number;
          comments?: number;
          shares?: number;
          engagement_rate?: number | null;
          tracked_at?: string;
        };
        Update: {
          id?: string;
          upload_id?: string;
          views?: number;
          likes?: number;
          comments?: number;
          shares?: number;
          engagement_rate?: number | null;
          tracked_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "content_metrics_upload_id_fkey";
            columns: ["upload_id"];
            isOneToOne: false;
            referencedRelation: "multi_channel_uploads";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// Helper types
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
