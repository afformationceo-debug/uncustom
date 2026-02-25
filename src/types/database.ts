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
          campaign_type: string;
          target_countries: string[];
          target_platforms: string[];
          created_by: string | null;
          created_at: string;
          updated_at: string;
          // CRM columns
          crm_hospital_id: number | null;
          crm_hospital_code: string | null;
          business_number: string | null;
          commission_rate: number | null;
          address: string | null;
          phone_number: string | null;
          tax_invoice_email: string | null;
          ceo_name: string | null;
          operating_hours: string | null;
          crm_config: Json;
          sns_accounts: Json;
        };
        Insert: {
          id?: string;
          team_id: string;
          name: string;
          description?: string | null;
          status?: string;
          campaign_type?: string;
          target_countries?: string[];
          target_platforms?: string[];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          crm_hospital_id?: number | null;
          crm_hospital_code?: string | null;
          business_number?: string | null;
          commission_rate?: number | null;
          address?: string | null;
          phone_number?: string | null;
          tax_invoice_email?: string | null;
          ceo_name?: string | null;
          operating_hours?: string | null;
          crm_config?: Json;
          sns_accounts?: Json;
        };
        Update: {
          id?: string;
          team_id?: string;
          name?: string;
          description?: string | null;
          status?: string;
          campaign_type?: string;
          target_countries?: string[];
          target_platforms?: string[];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          crm_hospital_id?: number | null;
          crm_hospital_code?: string | null;
          business_number?: string | null;
          commission_rate?: number | null;
          address?: string | null;
          phone_number?: string | null;
          tax_invoice_email?: string | null;
          ceo_name?: string | null;
          operating_hours?: string | null;
          crm_config?: Json;
          sns_accounts?: Json;
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
          campaign_id: string | null;
          keyword: string;
          platform: string;
          country: string | null;
          target_country: string;
          estimated_count: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id?: string | null;
          keyword: string;
          platform?: string;
          country?: string | null;
          target_country?: string;
          estimated_count?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string | null;
          keyword?: string;
          platform?: string;
          country?: string | null;
          target_country?: string;
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
          campaign_id: string | null;
          account_username: string;
          platform: string;
          target_country: string;
          estimated_count: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id?: string | null;
          account_username: string;
          platform: string;
          target_country?: string;
          estimated_count?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string | null;
          account_username?: string;
          platform?: string;
          target_country?: string;
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
          campaign_id: string | null;
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
          campaign_id?: string | null;
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
          campaign_id?: string | null;
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
          is_verified: boolean;
          is_business: boolean;
          category: string | null;
          import_source: string | null;
          is_blue_verified: boolean | null;
          verified_type: string | null;
          location: string | null;
          heart_count: number | null;
          share_count: number | null;
          total_views: number | null;
          channel_joined_date: string | null;
          is_monetized: boolean | null;
          external_url: string | null;
          avg_likes: number | null;
          avg_comments: number | null;
          avg_views: number | null;
          avg_shares: number | null;
          source_content_url: string | null;
          source_content_text: string | null;
          source_content_media: Json | null;
          source_content_created_at: string | null;
          content_language: string | null;
          content_hashtags: string[] | null;
          account_created_at: string | null;
          is_private: boolean;
          cover_image_url: string | null;
          bookmark_count: number | null;
          quote_count: number | null;
          favourites_count: number | null;
          video_duration: number | null;
          video_title: string | null;
          listed_count: number | null;
          media_count: number | null;
          is_sponsored: boolean;
          is_retweet: boolean;
          is_reply: boolean;
          mentions: string[] | null;
          music_info: Json | null;
          product_type: string | null;
          real_name: string | null;
          birth_date: string | null;
          phone: string | null;
          // CRM columns
          crm_user_id: number | null;
          line_id: string | null;
          gender: string | null;
          default_settlement_info: Json | null;
          influence_score: number | null;
          content_quality_score: number | null;
          audience_authenticity_score: number | null;
          brand_collab_count: number;
          last_content_at: string | null;
          commerce_enabled: boolean;
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
          is_verified?: boolean;
          is_business?: boolean;
          category?: string | null;
          import_source?: string | null;
          is_blue_verified?: boolean | null;
          verified_type?: string | null;
          location?: string | null;
          heart_count?: number | null;
          share_count?: number | null;
          total_views?: number | null;
          channel_joined_date?: string | null;
          is_monetized?: boolean | null;
          external_url?: string | null;
          avg_likes?: number | null;
          avg_comments?: number | null;
          avg_views?: number | null;
          avg_shares?: number | null;
          source_content_url?: string | null;
          source_content_text?: string | null;
          source_content_media?: Json | null;
          source_content_created_at?: string | null;
          content_language?: string | null;
          content_hashtags?: string[] | null;
          account_created_at?: string | null;
          is_private?: boolean;
          cover_image_url?: string | null;
          bookmark_count?: number | null;
          quote_count?: number | null;
          favourites_count?: number | null;
          video_duration?: number | null;
          video_title?: string | null;
          listed_count?: number | null;
          media_count?: number | null;
          is_sponsored?: boolean;
          is_retweet?: boolean;
          is_reply?: boolean;
          mentions?: string[] | null;
          music_info?: Json | null;
          product_type?: string | null;
          real_name?: string | null;
          birth_date?: string | null;
          phone?: string | null;
          crm_user_id?: number | null;
          line_id?: string | null;
          gender?: string | null;
          default_settlement_info?: Json | null;
          influence_score?: number | null;
          content_quality_score?: number | null;
          audience_authenticity_score?: number | null;
          brand_collab_count?: number;
          last_content_at?: string | null;
          commerce_enabled?: boolean;
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
          is_verified?: boolean;
          is_business?: boolean;
          category?: string | null;
          import_source?: string | null;
          is_blue_verified?: boolean | null;
          verified_type?: string | null;
          location?: string | null;
          heart_count?: number | null;
          share_count?: number | null;
          total_views?: number | null;
          channel_joined_date?: string | null;
          is_monetized?: boolean | null;
          external_url?: string | null;
          avg_likes?: number | null;
          avg_comments?: number | null;
          avg_views?: number | null;
          avg_shares?: number | null;
          source_content_url?: string | null;
          source_content_text?: string | null;
          source_content_media?: Json | null;
          source_content_created_at?: string | null;
          content_language?: string | null;
          content_hashtags?: string[] | null;
          account_created_at?: string | null;
          is_private?: boolean;
          cover_image_url?: string | null;
          bookmark_count?: number | null;
          quote_count?: number | null;
          favourites_count?: number | null;
          video_duration?: number | null;
          video_title?: string | null;
          listed_count?: number | null;
          media_count?: number | null;
          is_sponsored?: boolean;
          is_retweet?: boolean;
          is_reply?: boolean;
          mentions?: string[] | null;
          music_info?: Json | null;
          product_type?: string | null;
          real_name?: string | null;
          birth_date?: string | null;
          phone?: string | null;
          crm_user_id?: number | null;
          line_id?: string | null;
          gender?: string | null;
          default_settlement_info?: Json | null;
          influence_score?: number | null;
          content_quality_score?: number | null;
          audience_authenticity_score?: number | null;
          brand_collab_count?: number;
          last_content_at?: string | null;
          commerce_enabled?: boolean;
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
          // Funnel management fields
          funnel_status: string;
          outreach_round: number;
          last_outreach_at: string | null;
          reply_channel: string | null;
          reply_date: string | null;
          reply_summary: string | null;
          interest_confirmed: boolean;
          interest_confirmed_at: string | null;
          client_approved: boolean;
          client_approved_at: string | null;
          client_note: string | null;
          final_confirmed: boolean;
          final_confirmed_at: string | null;
          payment_amount: number | null;
          payment_currency: string;
          invoice_amount: number | null;
          invoice_currency: string;
          guideline_url: string | null;
          guideline_sent: boolean;
          guideline_sent_at: string | null;
          crm_registered: boolean;
          crm_registered_at: string | null;
          crm_note: string | null;
          visit_scheduled_date: string | null;
          interpreter_needed: boolean;
          interpreter_name: string | null;
          visit_completed: boolean;
          visit_completed_at: string | null;
          shipping_sent: boolean;
          shipping_sent_at: string | null;
          shipping_received: boolean;
          shipping_received_at: string | null;
          tracking_number: string | null;
          shipping_carrier: string | null;
          shipping_address: string | null;
          upload_url: string | null;
          content_metrics_cache: Json | null;
          settlement_info: Json | null;
          influencer_payment_status: string;
          influencer_paid_at: string | null;
          influencer_paid_amount: number | null;
          client_payment_status: string;
          client_invoiced_at: string | null;
          client_paid_at: string | null;
          client_paid_amount: number | null;
          outreach_type: string;
          reply_channel_url: string | null;
          second_funnel_campaign_id: string | null;
          second_funnel_status: string | null;
          // CRM columns
          crm_reservation_id: number | null;
          crm_procedure: string | null;
          crm_requested_procedure: string | null;
          crm_data: Json;
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
          funnel_status?: string;
          outreach_round?: number;
          last_outreach_at?: string | null;
          reply_channel?: string | null;
          reply_date?: string | null;
          reply_summary?: string | null;
          interest_confirmed?: boolean;
          interest_confirmed_at?: string | null;
          client_approved?: boolean;
          client_approved_at?: string | null;
          client_note?: string | null;
          final_confirmed?: boolean;
          final_confirmed_at?: string | null;
          payment_amount?: number | null;
          payment_currency?: string;
          invoice_amount?: number | null;
          invoice_currency?: string;
          guideline_url?: string | null;
          guideline_sent?: boolean;
          guideline_sent_at?: string | null;
          crm_registered?: boolean;
          crm_registered_at?: string | null;
          crm_note?: string | null;
          visit_scheduled_date?: string | null;
          interpreter_needed?: boolean;
          interpreter_name?: string | null;
          visit_completed?: boolean;
          visit_completed_at?: string | null;
          shipping_sent?: boolean;
          shipping_sent_at?: string | null;
          shipping_received?: boolean;
          shipping_received_at?: string | null;
          tracking_number?: string | null;
          shipping_carrier?: string | null;
          shipping_address?: string | null;
          upload_url?: string | null;
          content_metrics_cache?: Json | null;
          settlement_info?: Json | null;
          influencer_payment_status?: string;
          influencer_paid_at?: string | null;
          influencer_paid_amount?: number | null;
          client_payment_status?: string;
          client_invoiced_at?: string | null;
          client_paid_at?: string | null;
          client_paid_amount?: number | null;
          outreach_type?: string;
          reply_channel_url?: string | null;
          second_funnel_campaign_id?: string | null;
          second_funnel_status?: string | null;
          crm_reservation_id?: number | null;
          crm_procedure?: string | null;
          crm_requested_procedure?: string | null;
          crm_data?: Json;
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
          funnel_status?: string;
          outreach_round?: number;
          last_outreach_at?: string | null;
          reply_channel?: string | null;
          reply_date?: string | null;
          reply_summary?: string | null;
          interest_confirmed?: boolean;
          interest_confirmed_at?: string | null;
          client_approved?: boolean;
          client_approved_at?: string | null;
          client_note?: string | null;
          final_confirmed?: boolean;
          final_confirmed_at?: string | null;
          payment_amount?: number | null;
          payment_currency?: string;
          invoice_amount?: number | null;
          invoice_currency?: string;
          guideline_url?: string | null;
          guideline_sent?: boolean;
          guideline_sent_at?: string | null;
          crm_registered?: boolean;
          crm_registered_at?: string | null;
          crm_note?: string | null;
          visit_scheduled_date?: string | null;
          interpreter_needed?: boolean;
          interpreter_name?: string | null;
          visit_completed?: boolean;
          visit_completed_at?: string | null;
          shipping_sent?: boolean;
          shipping_sent_at?: string | null;
          shipping_received?: boolean;
          shipping_received_at?: string | null;
          tracking_number?: string | null;
          shipping_carrier?: string | null;
          shipping_address?: string | null;
          upload_url?: string | null;
          content_metrics_cache?: Json | null;
          settlement_info?: Json | null;
          influencer_payment_status?: string;
          influencer_paid_at?: string | null;
          influencer_paid_amount?: number | null;
          client_payment_status?: string;
          client_invoiced_at?: string | null;
          client_paid_at?: string | null;
          client_paid_amount?: number | null;
          outreach_type?: string;
          reply_channel_url?: string | null;
          second_funnel_campaign_id?: string | null;
          second_funnel_status?: string | null;
          crm_reservation_id?: number | null;
          crm_procedure?: string | null;
          crm_requested_procedure?: string | null;
          crm_data?: Json;
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
      funnel_activity_log: {
        Row: {
          id: string;
          campaign_influencer_id: string | null;
          campaign_id: string | null;
          influencer_id: string | null;
          action: string;
          field_name: string | null;
          old_value: string | null;
          new_value: string | null;
          performed_by: string | null;
          performed_at: string;
        };
        Insert: {
          id?: string;
          campaign_influencer_id?: string | null;
          campaign_id?: string | null;
          influencer_id?: string | null;
          action: string;
          field_name?: string | null;
          old_value?: string | null;
          new_value?: string | null;
          performed_by?: string | null;
          performed_at?: string;
        };
        Update: {
          id?: string;
          campaign_influencer_id?: string | null;
          campaign_id?: string | null;
          influencer_id?: string | null;
          action?: string;
          field_name?: string | null;
          old_value?: string | null;
          new_value?: string | null;
          performed_by?: string | null;
          performed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "funnel_activity_log_campaign_influencer_id_fkey";
            columns: ["campaign_influencer_id"];
            isOneToOne: false;
            referencedRelation: "campaign_influencers";
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
          type: string;
          name: string | null;
          dm_body: string | null;
          proposal_id: string | null;
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
          type?: string;
          name?: string | null;
          dm_body?: string | null;
          proposal_id?: string | null;
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
          type?: string;
          name?: string | null;
          dm_body?: string | null;
          proposal_id?: string | null;
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
      proposals: {
        Row: {
          id: string;
          campaign_id: string | null;
          team_id: string;
          slug: string;
          title: string;
          language: string;
          hero_image_url: string | null;
          mission_html: string | null;
          mission_images: string[] | null;
          products: Json;
          required_tags: string[] | null;
          rewards_html: string | null;
          collect_instagram: boolean;
          collect_paypal: boolean;
          collect_basic_info: boolean;
          collect_shipping: boolean;
          allowed_countries: string[] | null;
          cs_channel: string | null;
          cs_account: string | null;
          notice_html: string | null;
          status: string;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id?: string | null;
          team_id: string;
          slug: string;
          title: string;
          language?: string;
          hero_image_url?: string | null;
          mission_html?: string | null;
          mission_images?: string[] | null;
          products?: Json;
          required_tags?: string[] | null;
          rewards_html?: string | null;
          collect_instagram?: boolean;
          collect_paypal?: boolean;
          collect_basic_info?: boolean;
          collect_shipping?: boolean;
          allowed_countries?: string[] | null;
          cs_channel?: string | null;
          cs_account?: string | null;
          notice_html?: string | null;
          status?: string;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string | null;
          team_id?: string;
          slug?: string;
          title?: string;
          language?: string;
          hero_image_url?: string | null;
          mission_html?: string | null;
          mission_images?: string[] | null;
          products?: Json;
          required_tags?: string[] | null;
          rewards_html?: string | null;
          collect_instagram?: boolean;
          collect_paypal?: boolean;
          collect_basic_info?: boolean;
          collect_shipping?: boolean;
          allowed_countries?: string[] | null;
          cs_channel?: string | null;
          cs_account?: string | null;
          notice_html?: string | null;
          status?: string;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "proposals_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proposals_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      proposal_responses: {
        Row: {
          id: string;
          proposal_id: string;
          influencer_name: string | null;
          instagram_id: string | null;
          email: string | null;
          phone: string | null;
          paypal_email: string | null;
          shipping_address: Json | null;
          message: string | null;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          proposal_id: string;
          influencer_name?: string | null;
          instagram_id?: string | null;
          email?: string | null;
          phone?: string | null;
          paypal_email?: string | null;
          shipping_address?: Json | null;
          message?: string | null;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          proposal_id?: string;
          influencer_name?: string | null;
          instagram_id?: string | null;
          email?: string | null;
          phone?: string | null;
          paypal_email?: string | null;
          shipping_address?: Json | null;
          message?: string | null;
          submitted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "proposal_responses_proposal_id_fkey";
            columns: ["proposal_id"];
            isOneToOne: false;
            referencedRelation: "proposals";
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
      crm_sync_log: {
        Row: {
          id: string;
          direction: string;
          entity_type: string;
          crm_id: number | null;
          uncustom_id: string | null;
          action: string;
          details: Json | null;
          synced_at: string;
        };
        Insert: {
          id?: string;
          direction: string;
          entity_type: string;
          crm_id?: number | null;
          uncustom_id?: string | null;
          action: string;
          details?: Json | null;
          synced_at?: string;
        };
        Update: {
          id?: string;
          direction?: string;
          entity_type?: string;
          crm_id?: number | null;
          uncustom_id?: string | null;
          action?: string;
          details?: Json | null;
          synced_at?: string;
        };
        Relationships: [];
      };
      crm_procedures: {
        Row: {
          id: string;
          campaign_id: string | null;
          crm_procedure_id: number | null;
          name: string;
          description: string | null;
          price: number | null;
          fee_rate: number | null;
          is_sponsorable: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id?: string | null;
          crm_procedure_id?: number | null;
          name: string;
          description?: string | null;
          price?: number | null;
          fee_rate?: number | null;
          is_sponsorable?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string | null;
          crm_procedure_id?: number | null;
          name?: string;
          description?: string | null;
          price?: number | null;
          fee_rate?: number | null;
          is_sponsorable?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crm_procedures_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_accounts: {
        Row: {
          id: string;
          team_id: string;
          campaign_id: string | null;
          platform: string;
          username: string;
          platform_id: string | null;
          display_name: string | null;
          profile_url: string | null;
          profile_image_url: string | null;
          brand_name: string | null;
          brand_group: string | null;
          industry: string | null;
          sub_category: string | null;
          target_countries: string[];
          target_demographics: Json;
          follower_count: number | null;
          following_count: number | null;
          engagement_rate: number | null;
          avg_likes: number | null;
          avg_comments: number | null;
          avg_views: number | null;
          avg_shares: number | null;
          avg_saves: number | null;
          post_count: number | null;
          content_style: string[];
          posting_frequency: string | null;
          brand_voice: string | null;
          top_hashtags: string[];
          primary_content_types: string[];
          audience_quality_score: number | null;
          biography: string | null;
          external_url: string | null;
          is_verified: boolean;
          is_business_account: boolean;
          business_category: string | null;
          raw_profile_data: Json;
          competitor_of: string[];
          analysis_enabled: boolean;
          analysis_interval_hours: number;
          last_analyzed_at: string | null;
          next_analysis_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          campaign_id?: string | null;
          platform: string;
          username: string;
          platform_id?: string | null;
          display_name?: string | null;
          profile_url?: string | null;
          profile_image_url?: string | null;
          brand_name?: string | null;
          brand_group?: string | null;
          industry?: string | null;
          sub_category?: string | null;
          target_countries?: string[];
          target_demographics?: Json;
          follower_count?: number | null;
          following_count?: number | null;
          engagement_rate?: number | null;
          avg_likes?: number | null;
          avg_comments?: number | null;
          avg_views?: number | null;
          avg_shares?: number | null;
          avg_saves?: number | null;
          post_count?: number | null;
          content_style?: string[];
          posting_frequency?: string | null;
          brand_voice?: string | null;
          top_hashtags?: string[];
          primary_content_types?: string[];
          audience_quality_score?: number | null;
          biography?: string | null;
          external_url?: string | null;
          is_verified?: boolean;
          is_business_account?: boolean;
          business_category?: string | null;
          raw_profile_data?: Json;
          competitor_of?: string[];
          analysis_enabled?: boolean;
          analysis_interval_hours?: number;
          last_analyzed_at?: string | null;
          next_analysis_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          campaign_id?: string | null;
          platform?: string;
          username?: string;
          platform_id?: string | null;
          display_name?: string | null;
          profile_url?: string | null;
          profile_image_url?: string | null;
          brand_name?: string | null;
          brand_group?: string | null;
          industry?: string | null;
          sub_category?: string | null;
          target_countries?: string[];
          target_demographics?: Json;
          follower_count?: number | null;
          following_count?: number | null;
          engagement_rate?: number | null;
          avg_likes?: number | null;
          avg_comments?: number | null;
          avg_views?: number | null;
          avg_shares?: number | null;
          avg_saves?: number | null;
          post_count?: number | null;
          content_style?: string[];
          posting_frequency?: string | null;
          brand_voice?: string | null;
          top_hashtags?: string[];
          primary_content_types?: string[];
          audience_quality_score?: number | null;
          biography?: string | null;
          external_url?: string | null;
          is_verified?: boolean;
          is_business_account?: boolean;
          business_category?: string | null;
          raw_profile_data?: Json;
          competitor_of?: string[];
          analysis_enabled?: boolean;
          analysis_interval_hours?: number;
          last_analyzed_at?: string | null;
          next_analysis_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_accounts_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_accounts_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_account_analysis: {
        Row: {
          id: string;
          brand_account_id: string;
          analysis_period_start: string;
          analysis_period_end: string;
          follower_count_start: number | null;
          follower_count_end: number | null;
          follower_growth_rate: number | null;
          post_count_delta: number | null;
          avg_engagement_rate: number | null;
          avg_likes: number | null;
          avg_comments: number | null;
          avg_views: number | null;
          avg_shares: number | null;
          avg_saves: number | null;
          content_type_breakdown: Json;
          content_category_breakdown: Json;
          top_performing_content: Json;
          audience_demographics: Json;
          hashtags_used: Json;
          new_hashtags: string[];
          influencer_mentions_count: number;
          new_influencer_partners: number;
          extraction_job_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_account_id: string;
          analysis_period_start: string;
          analysis_period_end: string;
          follower_count_start?: number | null;
          follower_count_end?: number | null;
          follower_growth_rate?: number | null;
          post_count_delta?: number | null;
          avg_engagement_rate?: number | null;
          avg_likes?: number | null;
          avg_comments?: number | null;
          avg_views?: number | null;
          avg_shares?: number | null;
          avg_saves?: number | null;
          content_type_breakdown?: Json;
          content_category_breakdown?: Json;
          top_performing_content?: Json;
          audience_demographics?: Json;
          hashtags_used?: Json;
          new_hashtags?: string[];
          influencer_mentions_count?: number;
          new_influencer_partners?: number;
          extraction_job_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          brand_account_id?: string;
          analysis_period_start?: string;
          analysis_period_end?: string;
          follower_count_start?: number | null;
          follower_count_end?: number | null;
          follower_growth_rate?: number | null;
          post_count_delta?: number | null;
          avg_engagement_rate?: number | null;
          avg_likes?: number | null;
          avg_comments?: number | null;
          avg_views?: number | null;
          avg_shares?: number | null;
          avg_saves?: number | null;
          content_type_breakdown?: Json;
          content_category_breakdown?: Json;
          top_performing_content?: Json;
          audience_demographics?: Json;
          hashtags_used?: Json;
          new_hashtags?: string[];
          influencer_mentions_count?: number;
          new_influencer_partners?: number;
          extraction_job_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_account_analysis_brand_account_id_fkey";
            columns: ["brand_account_id"];
            isOneToOne: false;
            referencedRelation: "brand_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_influencer_contents: {
        Row: {
          id: string;
          brand_account_id: string;
          influencer_id: string | null;
          influencer_username: string | null;
          platform: string;
          content_url: string | null;
          content_platform_id: string | null;
          content_type: string | null;
          caption: string | null;
          hashtags: string[];
          mentions: string[];
          media_urls: Json;
          thumbnail_url: string | null;
          views_count: number;
          likes_count: number;
          comments_count: number;
          shares_count: number;
          saves_count: number;
          engagement_rate: number | null;
          posted_at: string | null;
          is_sponsored: boolean;
          is_organic: boolean;
          sponsorship_indicators: string[];
          detected_products: string[];
          brand_mention_type: string | null;
          sentiment_score: number | null;
          sentiment_label: string | null;
          discovered_via: string | null;
          extraction_job_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_account_id: string;
          influencer_id?: string | null;
          influencer_username?: string | null;
          platform: string;
          content_url?: string | null;
          content_platform_id?: string | null;
          content_type?: string | null;
          caption?: string | null;
          hashtags?: string[];
          mentions?: string[];
          media_urls?: Json;
          thumbnail_url?: string | null;
          views_count?: number;
          likes_count?: number;
          comments_count?: number;
          shares_count?: number;
          saves_count?: number;
          engagement_rate?: number | null;
          posted_at?: string | null;
          is_sponsored?: boolean;
          is_organic?: boolean;
          sponsorship_indicators?: string[];
          detected_products?: string[];
          brand_mention_type?: string | null;
          sentiment_score?: number | null;
          sentiment_label?: string | null;
          discovered_via?: string | null;
          extraction_job_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          brand_account_id?: string;
          influencer_id?: string | null;
          influencer_username?: string | null;
          platform?: string;
          content_url?: string | null;
          content_platform_id?: string | null;
          content_type?: string | null;
          caption?: string | null;
          hashtags?: string[];
          mentions?: string[];
          media_urls?: Json;
          thumbnail_url?: string | null;
          views_count?: number;
          likes_count?: number;
          comments_count?: number;
          shares_count?: number;
          saves_count?: number;
          engagement_rate?: number | null;
          posted_at?: string | null;
          is_sponsored?: boolean;
          is_organic?: boolean;
          sponsorship_indicators?: string[];
          detected_products?: string[];
          brand_mention_type?: string | null;
          sentiment_score?: number | null;
          sentiment_label?: string | null;
          discovered_via?: string | null;
          extraction_job_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_influencer_contents_brand_account_id_fkey";
            columns: ["brand_account_id"];
            isOneToOne: false;
            referencedRelation: "brand_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_influencer_contents_influencer_id_fkey";
            columns: ["influencer_id"];
            isOneToOne: false;
            referencedRelation: "influencers";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_influencer_relationships: {
        Row: {
          id: string;
          brand_account_id: string;
          influencer_id: string;
          total_collaborations: number;
          sponsored_count: number;
          organic_count: number;
          avg_views: number | null;
          avg_likes: number | null;
          avg_comments: number | null;
          avg_shares: number | null;
          avg_engagement_rate: number | null;
          total_views: number;
          first_collaboration_at: string | null;
          last_collaboration_at: string | null;
          avg_days_between_collabs: number | null;
          collaboration_recency_days: number | null;
          relationship_strength_score: number | null;
          estimated_collaboration_value: number | null;
          estimated_cpm: number | null;
          likely_payment_model: string | null;
          is_brand_ambassador: boolean;
          is_active: boolean;
          is_exclusive: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_account_id: string;
          influencer_id: string;
          total_collaborations?: number;
          sponsored_count?: number;
          organic_count?: number;
          avg_views?: number | null;
          avg_likes?: number | null;
          avg_comments?: number | null;
          avg_shares?: number | null;
          avg_engagement_rate?: number | null;
          total_views?: number;
          first_collaboration_at?: string | null;
          last_collaboration_at?: string | null;
          avg_days_between_collabs?: number | null;
          collaboration_recency_days?: number | null;
          relationship_strength_score?: number | null;
          estimated_collaboration_value?: number | null;
          estimated_cpm?: number | null;
          likely_payment_model?: string | null;
          is_brand_ambassador?: boolean;
          is_active?: boolean;
          is_exclusive?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          brand_account_id?: string;
          influencer_id?: string;
          total_collaborations?: number;
          sponsored_count?: number;
          organic_count?: number;
          avg_views?: number | null;
          avg_likes?: number | null;
          avg_comments?: number | null;
          avg_shares?: number | null;
          avg_engagement_rate?: number | null;
          total_views?: number;
          first_collaboration_at?: string | null;
          last_collaboration_at?: string | null;
          avg_days_between_collabs?: number | null;
          collaboration_recency_days?: number | null;
          relationship_strength_score?: number | null;
          estimated_collaboration_value?: number | null;
          estimated_cpm?: number | null;
          likely_payment_model?: string | null;
          is_brand_ambassador?: boolean;
          is_active?: boolean;
          is_exclusive?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_influencer_relationships_brand_account_id_fkey";
            columns: ["brand_account_id"];
            isOneToOne: false;
            referencedRelation: "brand_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_influencer_relationships_influencer_id_fkey";
            columns: ["influencer_id"];
            isOneToOne: false;
            referencedRelation: "influencers";
            referencedColumns: ["id"];
          },
        ];
      };
      influencer_content_history: {
        Row: {
          id: string;
          influencer_id: string;
          platform: string;
          content_url: string | null;
          content_platform_id: string | null;
          content_type: string | null;
          caption: string | null;
          media_urls: Json;
          thumbnail_url: string | null;
          views_count: number;
          likes_count: number;
          comments_count: number;
          shares_count: number;
          saves_count: number;
          engagement_rate: number | null;
          posted_at: string | null;
          scraped_at: string;
          content_category: string | null;
          content_theme: string | null;
          is_collaboration: boolean;
          collaboration_brand: string | null;
          is_sponsored: boolean;
          brand_mentions: string[];
          product_mentions: string[];
          sponsorship_signals: string[];
          music_info: Json | null;
          duration_seconds: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          influencer_id: string;
          platform: string;
          content_url?: string | null;
          content_platform_id?: string | null;
          content_type?: string | null;
          caption?: string | null;
          media_urls?: Json;
          thumbnail_url?: string | null;
          views_count?: number;
          likes_count?: number;
          comments_count?: number;
          shares_count?: number;
          saves_count?: number;
          engagement_rate?: number | null;
          posted_at?: string | null;
          scraped_at?: string;
          content_category?: string | null;
          content_theme?: string | null;
          is_collaboration?: boolean;
          collaboration_brand?: string | null;
          is_sponsored?: boolean;
          brand_mentions?: string[];
          product_mentions?: string[];
          sponsorship_signals?: string[];
          music_info?: Json | null;
          duration_seconds?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          influencer_id?: string;
          platform?: string;
          content_url?: string | null;
          content_platform_id?: string | null;
          content_type?: string | null;
          caption?: string | null;
          media_urls?: Json;
          thumbnail_url?: string | null;
          views_count?: number;
          likes_count?: number;
          comments_count?: number;
          shares_count?: number;
          saves_count?: number;
          engagement_rate?: number | null;
          posted_at?: string | null;
          scraped_at?: string;
          content_category?: string | null;
          content_theme?: string | null;
          is_collaboration?: boolean;
          collaboration_brand?: string | null;
          is_sponsored?: boolean;
          brand_mentions?: string[];
          product_mentions?: string[];
          sponsorship_signals?: string[];
          music_info?: Json | null;
          duration_seconds?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "influencer_content_history_influencer_id_fkey";
            columns: ["influencer_id"];
            isOneToOne: false;
            referencedRelation: "influencers";
            referencedColumns: ["id"];
          },
        ];
      };
      influencer_analytics: {
        Row: {
          id: string;
          influencer_id: string;
          analysis_period_start: string;
          analysis_period_end: string;
          follower_count_start: number | null;
          follower_count_end: number | null;
          follower_growth_rate: number | null;
          avg_engagement_rate: number | null;
          engagement_rate_trend: string | null;
          posting_frequency: number | null;
          content_type_breakdown: Json;
          content_category_breakdown: Json;
          brand_collab_count: number;
          brand_collab_frequency: number | null;
          brands_mentioned: string[];
          new_brand_partners: string[];
          content_quality_score: number | null;
          audience_authenticity_score: number | null;
          influence_score: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          influencer_id: string;
          analysis_period_start: string;
          analysis_period_end: string;
          follower_count_start?: number | null;
          follower_count_end?: number | null;
          follower_growth_rate?: number | null;
          avg_engagement_rate?: number | null;
          engagement_rate_trend?: string | null;
          posting_frequency?: number | null;
          content_type_breakdown?: Json;
          content_category_breakdown?: Json;
          brand_collab_count?: number;
          brand_collab_frequency?: number | null;
          brands_mentioned?: string[];
          new_brand_partners?: string[];
          content_quality_score?: number | null;
          audience_authenticity_score?: number | null;
          influence_score?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          influencer_id?: string;
          analysis_period_start?: string;
          analysis_period_end?: string;
          follower_count_start?: number | null;
          follower_count_end?: number | null;
          follower_growth_rate?: number | null;
          avg_engagement_rate?: number | null;
          engagement_rate_trend?: string | null;
          posting_frequency?: number | null;
          content_type_breakdown?: Json;
          content_category_breakdown?: Json;
          brand_collab_count?: number;
          brand_collab_frequency?: number | null;
          brands_mentioned?: string[];
          new_brand_partners?: string[];
          content_quality_score?: number | null;
          audience_authenticity_score?: number | null;
          influence_score?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "influencer_analytics_influencer_id_fkey";
            columns: ["influencer_id"];
            isOneToOne: false;
            referencedRelation: "influencers";
            referencedColumns: ["id"];
          },
        ];
      };
      influencer_commerce: {
        Row: {
          id: string;
          influencer_id: string;
          tiktok_shop_url: string | null;
          tiktok_shop_id: string | null;
          instagram_shop_url: string | null;
          affiliate_links: Json;
          affiliate_code: string | null;
          total_clicks: number;
          total_orders: number;
          total_revenue: number;
          total_commission: number;
          conversion_rate: number | null;
          average_order_value: number | null;
          campaign_spend: number | null;
          roas: number | null;
          cpa: number | null;
          cpe: number | null;
          products_sold: Json;
          top_product: string | null;
          product_categories: string[];
          commission_rate: number | null;
          commission_model: string | null;
          data_source: string | null;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          influencer_id: string;
          tiktok_shop_url?: string | null;
          tiktok_shop_id?: string | null;
          instagram_shop_url?: string | null;
          affiliate_links?: Json;
          affiliate_code?: string | null;
          total_clicks?: number;
          total_orders?: number;
          total_revenue?: number;
          total_commission?: number;
          conversion_rate?: number | null;
          average_order_value?: number | null;
          campaign_spend?: number | null;
          roas?: number | null;
          cpa?: number | null;
          cpe?: number | null;
          products_sold?: Json;
          top_product?: string | null;
          product_categories?: string[];
          commission_rate?: number | null;
          commission_model?: string | null;
          data_source?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          influencer_id?: string;
          tiktok_shop_url?: string | null;
          tiktok_shop_id?: string | null;
          instagram_shop_url?: string | null;
          affiliate_links?: Json;
          affiliate_code?: string | null;
          total_clicks?: number;
          total_orders?: number;
          total_revenue?: number;
          total_commission?: number;
          conversion_rate?: number | null;
          average_order_value?: number | null;
          campaign_spend?: number | null;
          roas?: number | null;
          cpa?: number | null;
          cpe?: number | null;
          products_sold?: Json;
          top_product?: string | null;
          product_categories?: string[];
          commission_rate?: number | null;
          commission_model?: string | null;
          data_source?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "influencer_commerce_influencer_id_fkey";
            columns: ["influencer_id"];
            isOneToOne: true;
            referencedRelation: "influencers";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_conversations: {
        Row: {
          id: string;
          user_id: string;
          team_id: string;
          page_context: string | null;
          campaign_id: string | null;
          title: string | null;
          messages: Json;
          model_id: string;
          total_input_tokens: number;
          total_output_tokens: number;
          total_cost_usd: number;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          team_id: string;
          page_context?: string | null;
          campaign_id?: string | null;
          title?: string | null;
          messages?: Json;
          model_id?: string;
          total_input_tokens?: number;
          total_output_tokens?: number;
          total_cost_usd?: number;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          team_id?: string;
          page_context?: string | null;
          campaign_id?: string | null;
          title?: string | null;
          messages?: Json;
          model_id?: string;
          total_input_tokens?: number;
          total_output_tokens?: number;
          total_cost_usd?: number;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_conversations_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_conversations_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_actions: {
        Row: {
          id: string;
          team_id: string;
          conversation_id: string | null;
          action_type: string;
          action_payload: Json;
          status: string;
          approved_by: string | null;
          approved_at: string | null;
          executed_at: string | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          conversation_id?: string | null;
          action_type: string;
          action_payload?: Json;
          status?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          executed_at?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          conversation_id?: string | null;
          action_type?: string;
          action_payload?: Json;
          status?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          executed_at?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_actions_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_actions_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "ai_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_insights: {
        Row: {
          id: string;
          team_id: string;
          campaign_id: string | null;
          insight_type: string;
          priority: string;
          title: string;
          body: string;
          data: Json;
          page_context: string | null;
          dismissed: boolean;
          is_read: boolean;
          is_pinned: boolean;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          campaign_id?: string | null;
          insight_type: string;
          priority?: string;
          title: string;
          body: string;
          data?: Json;
          page_context?: string | null;
          dismissed?: boolean;
          is_read?: boolean;
          is_pinned?: boolean;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          campaign_id?: string | null;
          insight_type?: string;
          priority?: string;
          title?: string;
          body?: string;
          data?: Json;
          page_context?: string | null;
          dismissed?: boolean;
          is_read?: boolean;
          is_pinned?: boolean;
          expires_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_insights_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_insights_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_token_usage: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          conversation_id: string | null;
          model_id: string;
          input_tokens: number;
          output_tokens: number;
          cost_usd: number;
          endpoint: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          conversation_id?: string | null;
          model_id: string;
          input_tokens?: number;
          output_tokens?: number;
          cost_usd?: number;
          endpoint?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          user_id?: string;
          conversation_id?: string | null;
          model_id?: string;
          input_tokens?: number;
          output_tokens?: number;
          cost_usd?: number;
          endpoint?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_token_usage_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_token_usage_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "ai_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      data_refresh_jobs: {
        Row: {
          id: string;
          team_id: string;
          entity_type: string;
          entity_id: string;
          refresh_interval_hours: number;
          priority: number;
          status: string;
          last_run_at: string | null;
          next_run_at: string | null;
          estimated_cost_usd: number | null;
          actual_cost_usd: number | null;
          error_message: string | null;
          run_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          entity_type: string;
          entity_id: string;
          refresh_interval_hours?: number;
          priority?: number;
          status?: string;
          last_run_at?: string | null;
          next_run_at?: string | null;
          estimated_cost_usd?: number | null;
          actual_cost_usd?: number | null;
          error_message?: string | null;
          run_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          entity_type?: string;
          entity_id?: string;
          refresh_interval_hours?: number;
          priority?: number;
          status?: string;
          last_run_at?: string | null;
          next_run_at?: string | null;
          estimated_cost_usd?: number | null;
          actual_cost_usd?: number | null;
          error_message?: string | null;
          run_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "data_refresh_jobs_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
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
