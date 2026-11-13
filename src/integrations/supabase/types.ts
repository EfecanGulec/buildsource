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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agreements: {
        Row: {
          buyer_delivery_note: string | null
          buyer_latest_date: string | null
          buyer_signature_code: string | null
          buyer_signed_at: string | null
          created_at: string
          delivery_date: string | null
          delivery_date_rejection: string | null
          delivery_details: Json | null
          delivery_details_required: boolean
          delivery_time_window: string | null
          id: string
          lead_time_days: number | null
          payment_terms: string | null
          quote_id: string
          quote_version_id: string
          rfq_id: string
          status: string
          supplier_signature_code: string | null
          supplier_signed_at: string | null
          total: number
        }
        Insert: {
          buyer_delivery_note?: string | null
          buyer_latest_date?: string | null
          buyer_signature_code?: string | null
          buyer_signed_at?: string | null
          created_at?: string
          delivery_date?: string | null
          delivery_date_rejection?: string | null
          delivery_details?: Json | null
          delivery_details_required?: boolean
          delivery_time_window?: string | null
          id?: string
          lead_time_days?: number | null
          payment_terms?: string | null
          quote_id: string
          quote_version_id: string
          rfq_id: string
          status?: string
          supplier_signature_code?: string | null
          supplier_signed_at?: string | null
          total: number
        }
        Update: {
          buyer_delivery_note?: string | null
          buyer_latest_date?: string | null
          buyer_signature_code?: string | null
          buyer_signed_at?: string | null
          created_at?: string
          delivery_date?: string | null
          delivery_date_rejection?: string | null
          delivery_details?: Json | null
          delivery_details_required?: boolean
          delivery_time_window?: string | null
          id?: string
          lead_time_days?: number | null
          payment_terms?: string | null
          quote_id?: string
          quote_version_id?: string
          rfq_id?: string
          status?: string
          supplier_signature_code?: string | null
          supplier_signed_at?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "agreements_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_quote_version_id_fkey"
            columns: ["quote_version_id"]
            isOneToOne: false
            referencedRelation: "quote_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          recipient_id: string
          rfq_id: string
          scope: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          recipient_id: string
          rfq_id: string
          scope: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          recipient_id?: string
          rfq_id?: string
          scope?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          profile_id: string
          role: string
          tokens: number | null
          tool_calls: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          profile_id: string
          role: string
          tokens?: number | null
          tool_calls?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          profile_id?: string
          role?: string
          tokens?: number | null
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_profile_id: string | null
          created_at: string
          data: Json
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          created_at?: string
          data?: Json
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          created_at?: string
          data?: Json
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      buyer_reliability: {
        Row: {
          company_id: string
          late_confirmations: number
          orders_completed: number
          pool_no_shows: number
          rfqs_created: number
          score: number
        }
        Insert: {
          company_id: string
          late_confirmations?: number
          orders_completed?: number
          pool_no_shows?: number
          rfqs_created?: number
          score?: number
        }
        Update: {
          company_id?: string
          late_confirmations?: number
          orders_completed?: number
          pool_no_shows?: number
          rfqs_created?: number
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "buyer_reliability_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          commission_group: string
          commission_rate: number | null
          created_at: string
          default_unit: string | null
          field_template: Json
          group: string
          id: string
          name_en: string
          name_lt: string | null
          parent_id: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          commission_group?: string
          commission_rate?: number | null
          created_at?: string
          default_unit?: string | null
          field_template?: Json
          group: string
          id?: string
          name_en: string
          name_lt?: string | null
          parent_id?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          commission_group?: string
          commission_rate?: number | null
          created_at?: string
          default_unit?: string | null
          field_template?: Json
          group?: string
          id?: string
          name_en?: string
          name_lt?: string | null
          parent_id?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          bank_account_iban: string | null
          bank_account_verified: boolean
          buyer_segment: Database["public"]["Enums"]["buyer_segment"] | null
          city: string | null
          claimed_at: string | null
          company_code: string
          contact_email: string | null
          country: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_claimed: boolean
          is_demo: boolean
          logo_url: string | null
          name: string
          type: Database["public"]["Enums"]["company_type"]
          updated_at: string
          vat_code: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          bank_account_iban?: string | null
          bank_account_verified?: boolean
          buyer_segment?: Database["public"]["Enums"]["buyer_segment"] | null
          city?: string | null
          claimed_at?: string | null
          company_code: string
          contact_email?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_claimed?: boolean
          is_demo?: boolean
          logo_url?: string | null
          name: string
          type: Database["public"]["Enums"]["company_type"]
          updated_at?: string
          vat_code?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          bank_account_iban?: string | null
          bank_account_verified?: boolean
          buyer_segment?: Database["public"]["Enums"]["buyer_segment"] | null
          city?: string | null
          claimed_at?: string | null
          company_code?: string
          contact_email?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_claimed?: boolean
          is_demo?: boolean
          logo_url?: string | null
          name?: string
          type?: Database["public"]["Enums"]["company_type"]
          updated_at?: string
          vat_code?: string | null
          website?: string | null
        }
        Relationships: []
      }
      company_public_data: {
        Row: {
          activity_codes: string[]
          avg_wage: number | null
          company_id: string
          data_date: string | null
          employees: number | null
          registered_date: string | null
          sodra_debt: boolean
          status: string
          tax_debt: boolean
          tender_wins: number
          vat_valid: boolean
        }
        Insert: {
          activity_codes?: string[]
          avg_wage?: number | null
          company_id: string
          data_date?: string | null
          employees?: number | null
          registered_date?: string | null
          sodra_debt?: boolean
          status?: string
          tax_debt?: boolean
          tender_wins?: number
          vat_valid?: boolean
        }
        Update: {
          activity_codes?: string[]
          avg_wage?: number | null
          company_id?: string
          data_date?: string | null
          employees?: number | null
          registered_date?: string | null
          sodra_debt?: boolean
          status?: string
          tax_debt?: boolean
          tender_wins?: number
          vat_valid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "company_public_data_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          created_at: string
          description: string | null
          held_amount: number
          id: string
          opened_by: string | null
          order_id: string
          photo_urls: string[]
          reason: string
          resolution_note: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["dispute_status"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          held_amount?: number
          id?: string
          opened_by?: string | null
          order_id: string
          photo_urls?: string[]
          reason: string
          resolution_note?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
        }
        Update: {
          created_at?: string
          description?: string | null
          held_amount?: number
          id?: string
          opened_by?: string | null
          order_id?: string
          photo_urls?: string[]
          reason?: string
          resolution_note?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
        }
        Relationships: [
          {
            foreignKeyName: "disputes_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_runs: {
        Row: {
          added: number
          deactivated: number
          errors: Json
          feed_id: string
          finished_at: string | null
          id: string
          started_at: string
          updated: number
        }
        Insert: {
          added?: number
          deactivated?: number
          errors?: Json
          feed_id: string
          finished_at?: string | null
          id?: string
          started_at?: string
          updated?: number
        }
        Update: {
          added?: number
          deactivated?: number
          errors?: Json
          feed_id?: string
          finished_at?: string | null
          id?: string
          started_at?: string
          updated?: number
        }
        Relationships: [
          {
            foreignKeyName: "feed_runs_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "product_feeds"
            referencedColumns: ["id"]
          },
        ]
      }
      financing_requests: {
        Row: {
          amount: number
          buyer_company_id: string
          created_at: string
          decided_at: string | null
          id: string
          order_id: string
          partner_fee_rate: number | null
          status: string
          term_days: number
        }
        Insert: {
          amount: number
          buyer_company_id: string
          created_at?: string
          decided_at?: string | null
          id?: string
          order_id: string
          partner_fee_rate?: number | null
          status?: string
          term_days: number
        }
        Update: {
          amount?: number
          buyer_company_id?: string
          created_at?: string
          decided_at?: string | null
          id?: string
          order_id?: string
          partner_fee_rate?: number | null
          status?: string
          term_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "financing_requests_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financing_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      group_buy_pools: {
        Row: {
          base_price: number
          category_id: string | null
          certificates: Json
          closed_at: string | null
          closed_qty: number | null
          confirm_until: string | null
          confirm_window_hours: number
          created_at: string
          datasheet_url: string | null
          deadline: string | null
          delivery_week: string | null
          final_discount_pct: number | null
          final_unit_price: number | null
          id: string
          images: string[]
          keep_tier_threshold: number
          min_qty: number
          product_name: string
          product_specs: Json
          region: string | null
          status: Database["public"]["Enums"]["pool_status"]
          supplier_company_id: string
          tiers: Json
          unit: string
        }
        Insert: {
          base_price: number
          category_id?: string | null
          certificates?: Json
          closed_at?: string | null
          closed_qty?: number | null
          confirm_until?: string | null
          confirm_window_hours?: number
          created_at?: string
          datasheet_url?: string | null
          deadline?: string | null
          delivery_week?: string | null
          final_discount_pct?: number | null
          final_unit_price?: number | null
          id?: string
          images?: string[]
          keep_tier_threshold?: number
          min_qty?: number
          product_name: string
          product_specs?: Json
          region?: string | null
          status?: Database["public"]["Enums"]["pool_status"]
          supplier_company_id: string
          tiers?: Json
          unit?: string
        }
        Update: {
          base_price?: number
          category_id?: string | null
          certificates?: Json
          closed_at?: string | null
          closed_qty?: number | null
          confirm_until?: string | null
          confirm_window_hours?: number
          created_at?: string
          datasheet_url?: string | null
          deadline?: string | null
          delivery_week?: string | null
          final_discount_pct?: number | null
          final_unit_price?: number | null
          id?: string
          images?: string[]
          keep_tier_threshold?: number
          min_qty?: number
          product_name?: string
          product_specs?: Json
          region?: string | null
          status?: Database["public"]["Enums"]["pool_status"]
          supplier_company_id?: string
          tiers?: Json
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_buy_pools_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_buy_pools_supplier_company_id_fkey"
            columns: ["supplier_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_sessions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          profile_id: string
          provider_session_id: string | null
          purpose: string
          result_personal_code_hash: string | null
          status: string
          verification_code: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          profile_id: string
          provider_session_id?: string | null
          purpose: string
          result_personal_code_hash?: string | null
          status?: string
          verification_code?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          profile_id?: string
          provider_session_id?: string | null
          purpose?: string
          result_personal_code_hash?: string | null
          status?: string
          verification_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "identity_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          action: string
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          provider: string | null
          request_summary: Json
          response_status: number | null
          service: string
        }
        Insert: {
          action: string
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          provider?: string | null
          request_summary?: Json
          response_status?: number | null
          service: string
        }
        Update: {
          action?: string
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          provider?: string | null
          request_summary?: Json
          response_status?: number | null
          service?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          config: Json
          id: string
          is_enabled: boolean
          last_error: string | null
          last_success_at: string | null
          mode: string
          provider: string
          service: string
          updated_at: string
        }
        Insert: {
          config?: Json
          id?: string
          is_enabled?: boolean
          last_error?: string | null
          last_success_at?: string | null
          mode?: string
          provider: string
          service: string
          updated_at?: string
        }
        Update: {
          config?: Json
          id?: string
          is_enabled?: boolean
          last_error?: string | null
          last_success_at?: string | null
          mode?: string
          provider?: string
          service?: string
          updated_at?: string
        }
        Relationships: []
      }
      kits: {
        Row: {
          created_at: string
          id: string
          items: Json
          name: string
          project_type: Database["public"]["Enums"]["project_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          name: string
          project_type: Database["public"]["Enums"]["project_type"]
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          name?: string
          project_type?: Database["public"]["Enums"]["project_type"]
        }
        Relationships: []
      }
      material_scans: {
        Row: {
          company_id: string
          created_at: string
          id: string
          note: string | null
          photo_paths: string[]
          profile_id: string
          result: Json
          saved: boolean
          source: string
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          note?: string | null
          photo_paths?: string[]
          profile_id?: string
          result?: Json
          saved?: boolean
          source?: string
          status: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          note?: string | null
          photo_paths?: string[]
          profile_id?: string
          result?: Json
          saved?: boolean
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_scans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: string[]
          body: string
          contains_contact_info: boolean
          created_at: string
          id: string
          is_ai: boolean
          quote_id: string | null
          read_at: string | null
          recipient_id: string
          rfq_id: string
          sender_party: Database["public"]["Enums"]["offer_party"]
          sender_profile_id: string | null
          translated_body: string | null
        }
        Insert: {
          attachments?: string[]
          body: string
          contains_contact_info?: boolean
          created_at?: string
          id?: string
          is_ai?: boolean
          quote_id?: string | null
          read_at?: string | null
          recipient_id: string
          rfq_id: string
          sender_party: Database["public"]["Enums"]["offer_party"]
          sender_profile_id?: string | null
          translated_body?: string | null
        }
        Update: {
          attachments?: string[]
          body?: string
          contains_contact_info?: boolean
          created_at?: string
          id?: string
          is_ai?: boolean
          quote_id?: string | null
          read_at?: string | null
          recipient_id?: string
          rfq_id?: string
          sender_party?: Database["public"]["Enums"]["offer_party"]
          sender_profile_id?: string | null
          translated_body?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "rfq_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          company_id: string | null
          created_at: string
          email_error: string | null
          email_status: string | null
          emailed_at: string | null
          id: string
          link: string | null
          profile_id: string | null
          read_at: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          company_id?: string | null
          created_at?: string
          email_error?: string | null
          email_status?: string | null
          emailed_at?: string | null
          id?: string
          link?: string | null
          profile_id?: string | null
          read_at?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          company_id?: string | null
          created_at?: string
          email_error?: string | null
          email_status?: string | null
          emailed_at?: string | null
          id?: string
          link?: string | null
          profile_id?: string | null
          read_at?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          order_id: string
          photo_urls: string[]
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id: string
          photo_urls?: string[]
          status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id?: string
          photo_urls?: string[]
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          agreement_id: string | null
          buyer_company_id: string
          commission_amount: number
          commission_rate: number
          created_at: string
          id: string
          order_number: string
          payment_due_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          pool_id: string | null
          rfq_id: string | null
          staged_payment: boolean
          status: Database["public"]["Enums"]["order_status"]
          supplier_company_id: string
          supplier_payout: number
          total: number
          updated_at: string
        }
        Insert: {
          agreement_id?: string | null
          buyer_company_id: string
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          id?: string
          order_number: string
          payment_due_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          pool_id?: string | null
          rfq_id?: string | null
          staged_payment?: boolean
          status?: Database["public"]["Enums"]["order_status"]
          supplier_company_id: string
          supplier_payout?: number
          total: number
          updated_at?: string
        }
        Update: {
          agreement_id?: string | null
          buyer_company_id?: string
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          id?: string
          order_number?: string
          payment_due_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          pool_id?: string | null
          rfq_id?: string | null
          staged_payment?: boolean
          status?: Database["public"]["Enums"]["order_status"]
          supplier_company_id?: string
          supplier_payout?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "group_buy_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_supplier_company_id_fkey"
            columns: ["supplier_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          held_at: string | null
          id: string
          milestone: string
          order_id: string
          platform_fee_cents: number | null
          provider: string
          provider_payment_id: string | null
          provider_refund_id: string | null
          provider_transfer_id: string | null
          refunded_amount: number
          released_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          held_at?: string | null
          id?: string
          milestone?: string
          order_id: string
          platform_fee_cents?: number | null
          provider?: string
          provider_payment_id?: string | null
          provider_refund_id?: string | null
          provider_transfer_id?: string | null
          refunded_amount?: number
          released_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          held_at?: string | null
          id?: string
          milestone?: string
          order_id?: string
          platform_fee_cents?: number | null
          provider?: string
          provider_payment_id?: string | null
          provider_refund_id?: string | null
          provider_transfer_id?: string | null
          refunded_amount?: number
          released_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      pool_members: {
        Row: {
          buyer_company_id: string
          confirmed_at: string | null
          id: string
          if_pool_fails: string
          joined_at: string
          order_id: string | null
          pool_id: string
          quantity: number
          rfq_id: string | null
          status: Database["public"]["Enums"]["pool_member_status"]
        }
        Insert: {
          buyer_company_id: string
          confirmed_at?: string | null
          id?: string
          if_pool_fails?: string
          joined_at?: string
          order_id?: string | null
          pool_id: string
          quantity: number
          rfq_id?: string | null
          status?: Database["public"]["Enums"]["pool_member_status"]
        }
        Update: {
          buyer_company_id?: string
          confirmed_at?: string | null
          id?: string
          if_pool_fails?: string
          joined_at?: string
          order_id?: string | null
          pool_id?: string
          quantity?: number
          rfq_id?: string | null
          status?: Database["public"]["Enums"]["pool_member_status"]
        }
        Relationships: [
          {
            foreignKeyName: "pool_members_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_members_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_members_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "group_buy_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_members_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      product_feeds: {
        Row: {
          created_at: string
          credentials_secret_ref: string | null
          field_mapping: Json
          id: string
          last_run_at: string | null
          last_status: string | null
          products_count: number
          schedule: string
          supplier_company_id: string
          type: string
          url: string | null
        }
        Insert: {
          created_at?: string
          credentials_secret_ref?: string | null
          field_mapping?: Json
          id?: string
          last_run_at?: string | null
          last_status?: string | null
          products_count?: number
          schedule?: string
          supplier_company_id: string
          type: string
          url?: string | null
        }
        Update: {
          created_at?: string
          credentials_secret_ref?: string | null
          field_mapping?: Json
          id?: string
          last_run_at?: string | null
          last_status?: string | null
          products_count?: number
          schedule?: string
          supplier_company_id?: string
          type?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_feeds_supplier_company_id_fkey"
            columns: ["supplier_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      production_milestones: {
        Row: {
          approved_by_buyer: boolean
          created_at: string
          id: string
          name: string
          order_id: string
          photo_urls: string[]
        }
        Insert: {
          approved_by_buyer?: boolean
          created_at?: string
          id?: string
          name: string
          order_id: string
          photo_urls?: string[]
        }
        Update: {
          approved_by_buyer?: boolean
          created_at?: string
          id?: string
          name?: string
          order_id?: string
          photo_urls?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "production_milestones_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          currency: string
          datasheet_url: string | null
          description: string | null
          external_id: string
          feed_id: string | null
          id: string
          images: string[]
          is_active: boolean
          lead_time_days: number | null
          list_price: number | null
          mapping_confidence: number | null
          mapping_confirmed: boolean
          name: string
          price_updated_at: string | null
          specs: Json
          stock_qty: number | null
          supplier_company_id: string
          unit: string | null
        }
        Insert: {
          category_id?: string | null
          currency?: string
          datasheet_url?: string | null
          description?: string | null
          external_id: string
          feed_id?: string | null
          id?: string
          images?: string[]
          is_active?: boolean
          lead_time_days?: number | null
          list_price?: number | null
          mapping_confidence?: number | null
          mapping_confirmed?: boolean
          name: string
          price_updated_at?: string | null
          specs?: Json
          stock_qty?: number | null
          supplier_company_id: string
          unit?: string | null
        }
        Update: {
          category_id?: string | null
          currency?: string
          datasheet_url?: string | null
          description?: string | null
          external_id?: string
          feed_id?: string | null
          id?: string
          images?: string[]
          is_active?: boolean
          lead_time_days?: number | null
          list_price?: number | null
          mapping_confidence?: number | null
          mapping_confirmed?: boolean
          name?: string
          price_updated_at?: string | null
          specs?: Json
          stock_qty?: number | null
          supplier_company_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "product_feeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_company_id_fkey"
            columns: ["supplier_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          city: string | null
          company_code: string | null
          company_id: string | null
          company_name: string | null
          country: string | null
          created_at: string
          default_delivery: Json | null
          email: string | null
          full_name: string | null
          id: string
          language: string
          phone: string | null
          smart_id_verified: boolean
          smart_id_verified_at: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          company_code?: string | null
          company_id?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          default_delivery?: Json | null
          email?: string | null
          full_name?: string | null
          id: string
          language?: string
          phone?: string | null
          smart_id_verified?: boolean
          smart_id_verified_at?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          company_code?: string | null
          company_id?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          default_delivery?: Json | null
          email?: string | null
          full_name?: string | null
          id?: string
          language?: string
          phone?: string | null
          smart_id_verified?: boolean
          smart_id_verified_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          buyer_company_id: string
          city: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          project_type: Database["public"]["Enums"]["project_type"]
        }
        Insert: {
          address?: string | null
          buyer_company_id: string
          city?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          project_type: Database["public"]["Enums"]["project_type"]
        }
        Update: {
          address?: string | null
          buyer_company_id?: string
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          project_type?: Database["public"]["Enums"]["project_type"]
        }
        Relationships: [
          {
            foreignKeyName: "projects_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      proof_of_delivery: {
        Row: {
          created_at: string
          id: string
          line_quantities: Json
          mismatch: boolean
          notes: string | null
          photo_urls: string[]
          receiver_name: string
          shipment_id: string
          signature_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          line_quantities?: Json
          mismatch?: boolean
          notes?: string | null
          photo_urls?: string[]
          receiver_name: string
          shipment_id: string
          signature_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          line_quantities?: Json
          mismatch?: boolean
          notes?: string | null
          photo_urls?: string[]
          receiver_name?: string
          shipment_id?: string
          signature_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proof_of_delivery_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: true
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_accounts: {
        Row: {
          company_id: string
          onboarding_status: string
          payouts_enabled: boolean
          provider: string
          provider_account_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          onboarding_status?: string
          payouts_enabled?: boolean
          provider: string
          provider_account_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          onboarding_status?: string
          payouts_enabled?: boolean
          provider?: string
          provider_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_versions: {
        Row: {
          attachments: string[]
          certificates: Json
          created_at: string
          created_by: string | null
          delivery_cost: number
          delivery_date: string | null
          drawing_url: string | null
          id: string
          images: string[]
          lead_time_days: number | null
          lines: Json
          message: string | null
          party: Database["public"]["Enums"]["offer_party"]
          payment_terms: string | null
          quote_id: string
          sample_available: boolean | null
          subtotal: number
          total: number
          valid_until: string | null
          version: number
          warehouse_origin: string | null
        }
        Insert: {
          attachments?: string[]
          certificates?: Json
          created_at?: string
          created_by?: string | null
          delivery_cost?: number
          delivery_date?: string | null
          drawing_url?: string | null
          id?: string
          images?: string[]
          lead_time_days?: number | null
          lines?: Json
          message?: string | null
          party: Database["public"]["Enums"]["offer_party"]
          payment_terms?: string | null
          quote_id: string
          sample_available?: boolean | null
          subtotal?: number
          total?: number
          valid_until?: string | null
          version: number
          warehouse_origin?: string | null
        }
        Update: {
          attachments?: string[]
          certificates?: Json
          created_at?: string
          created_by?: string | null
          delivery_cost?: number
          delivery_date?: string | null
          drawing_url?: string | null
          id?: string
          images?: string[]
          lead_time_days?: number | null
          lines?: Json
          message?: string | null
          party?: Database["public"]["Enums"]["offer_party"]
          payment_terms?: string | null
          quote_id?: string
          sample_available?: boolean | null
          subtotal?: number
          total?: number
          valid_until?: string | null
          version?: number
          warehouse_origin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_versions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          current_version: number
          id: string
          recipient_id: string
          rfq_id: string
          round_count: number
          status: Database["public"]["Enums"]["quote_status"]
          supplier_company_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_version?: number
          id?: string
          recipient_id: string
          rfq_id: string
          round_count?: number
          status?: Database["public"]["Enums"]["quote_status"]
          supplier_company_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_version?: number
          id?: string
          recipient_id?: string
          rfq_id?: string
          round_count?: number
          status?: Database["public"]["Enums"]["quote_status"]
          supplier_company_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "rfq_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_supplier_company_id_fkey"
            columns: ["supplier_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_id: string
          rating: number
          reviewer_company_id: string
          supplier_company_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          rating: number
          reviewer_company_id: string
          supplier_company_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          rating?: number
          reviewer_company_id?: string
          supplier_company_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_company_id_fkey"
            columns: ["reviewer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_supplier_company_id_fkey"
            columns: ["supplier_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_items: {
        Row: {
          ai_confidence: number | null
          buyer_confirmed: boolean
          category_id: string | null
          description: string
          id: string
          quantity: number
          rfq_id: string
          sort_order: number
          specs: Json
          standard: string | null
          unit: string | null
          waste_pct: number
        }
        Insert: {
          ai_confidence?: number | null
          buyer_confirmed?: boolean
          category_id?: string | null
          description: string
          id?: string
          quantity?: number
          rfq_id: string
          sort_order?: number
          specs?: Json
          standard?: string | null
          unit?: string | null
          waste_pct?: number
        }
        Update: {
          ai_confidence?: number | null
          buyer_confirmed?: boolean
          category_id?: string | null
          description?: string
          id?: string
          quantity?: number
          rfq_id?: string
          sort_order?: number
          specs?: Json
          standard?: string | null
          unit?: string | null
          waste_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "rfq_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_items_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_recipients: {
        Row: {
          decline_message: string | null
          decline_reason: Database["public"]["Enums"]["decline_reason"] | null
          id: string
          magic_token: string | null
          match_score: number | null
          rank: number | null
          reminder_sent_at: string | null
          responded_at: string | null
          rfq_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["recipient_status"]
          supplier_company_id: string
          viewed_at: string | null
        }
        Insert: {
          decline_message?: string | null
          decline_reason?: Database["public"]["Enums"]["decline_reason"] | null
          id?: string
          magic_token?: string | null
          match_score?: number | null
          rank?: number | null
          reminder_sent_at?: string | null
          responded_at?: string | null
          rfq_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["recipient_status"]
          supplier_company_id: string
          viewed_at?: string | null
        }
        Update: {
          decline_message?: string | null
          decline_reason?: Database["public"]["Enums"]["decline_reason"] | null
          id?: string
          magic_token?: string | null
          match_score?: number | null
          rank?: number | null
          reminder_sent_at?: string | null
          responded_at?: string | null
          rfq_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["recipient_status"]
          supplier_company_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_recipients_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_recipients_supplier_company_id_fkey"
            columns: ["supplier_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_site_contacts: {
        Row: {
          name: string | null
          phone: string | null
          rfq_id: string
        }
        Insert: {
          name?: string | null
          phone?: string | null
          rfq_id: string
        }
        Update: {
          name?: string | null
          phone?: string | null
          rfq_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_site_contacts_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: true
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfqs: {
        Row: {
          ai_upload_urls: string[]
          buyer_company_id: string
          closed_at: string | null
          created_at: string
          created_by: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_date_requested: string | null
          delivery_week: string | null
          delivery_window: string | null
          description: string | null
          id: string
          material_scan_id: string | null
          max_suppliers: number
          min_trust_score: number
          negotiation_round_limit: number
          preferred_supplier_ids: string[]
          project_id: string | null
          project_type: Database["public"]["Enums"]["project_type"]
          rfq_number: string
          site_access_notes: string | null
          source: string
          status: Database["public"]["Enums"]["rfq_status"]
          submitted_at: string | null
          title: string
          unloading: string | null
          updated_at: string
        }
        Insert: {
          ai_upload_urls?: string[]
          buyer_company_id: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_date_requested?: string | null
          delivery_week?: string | null
          delivery_window?: string | null
          description?: string | null
          id?: string
          material_scan_id?: string | null
          max_suppliers?: number
          min_trust_score?: number
          negotiation_round_limit?: number
          preferred_supplier_ids?: string[]
          project_id?: string | null
          project_type: Database["public"]["Enums"]["project_type"]
          rfq_number?: string
          site_access_notes?: string | null
          source?: string
          status?: Database["public"]["Enums"]["rfq_status"]
          submitted_at?: string | null
          title: string
          unloading?: string | null
          updated_at?: string
        }
        Update: {
          ai_upload_urls?: string[]
          buyer_company_id?: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_date_requested?: string | null
          delivery_week?: string | null
          delivery_window?: string | null
          description?: string | null
          id?: string
          material_scan_id?: string | null
          max_suppliers?: number
          min_trust_score?: number
          negotiation_round_limit?: number
          preferred_supplier_ids?: string[]
          project_id?: string | null
          project_type?: Database["public"]["Enums"]["project_type"]
          rfq_number?: string
          site_access_notes?: string | null
          source?: string
          status?: Database["public"]["Enums"]["rfq_status"]
          submitted_at?: string | null
          title?: string
          unloading?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfqs_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_material_scan_id_fkey"
            columns: ["material_scan_id"]
            isOneToOne: false
            referencedRelation: "material_scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier: string | null
          created_at: string
          driver_token: string | null
          eta: string | null
          id: string
          last_location: Json | null
          late_alerted_at: string | null
          lines: Json
          method: string
          order_id: string
          planned_date: string | null
          status: string
          tracking_number: string | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          driver_token?: string | null
          eta?: string | null
          id?: string
          last_location?: Json | null
          late_alerted_at?: string | null
          lines?: Json
          method: string
          order_id: string
          planned_date?: string | null
          status?: string
          tracking_number?: string | null
        }
        Update: {
          carrier?: string | null
          created_at?: string
          driver_token?: string | null
          eta?: string | null
          id?: string
          last_location?: Json | null
          late_alerted_at?: string | null
          lines?: Json
          method?: string
          order_id?: string
          planned_date?: string | null
          status?: string
          tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_categories: {
        Row: {
          category_id: string
          supplier_id: string
        }
        Insert: {
          category_id: string
          supplier_id: string
        }
        Update: {
          category_id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_categories_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_profiles: {
        Row: {
          avg_rating: number | null
          avg_response_hours: number | null
          certificates: Json
          company_id: string
          created_at: string
          disputes_lost: number
          installation_offered: boolean
          min_order_eur: number
          on_time_rate: number | null
          pro_subscription: boolean
          product_feed_url: string | null
          regions_served: string[]
          response_rate: number | null
          review_count: number
          service_area: string[]
          typical_lead_time_days: number | null
          updated_at: string
          warehouse_locations: Json
          warranty_months: number | null
          weekly_capacity: Json
        }
        Insert: {
          avg_rating?: number | null
          avg_response_hours?: number | null
          certificates?: Json
          company_id: string
          created_at?: string
          disputes_lost?: number
          installation_offered?: boolean
          min_order_eur?: number
          on_time_rate?: number | null
          pro_subscription?: boolean
          product_feed_url?: string | null
          regions_served?: string[]
          response_rate?: number | null
          review_count?: number
          service_area?: string[]
          typical_lead_time_days?: number | null
          updated_at?: string
          warehouse_locations?: Json
          warranty_months?: number | null
          weekly_capacity?: Json
        }
        Update: {
          avg_rating?: number | null
          avg_response_hours?: number | null
          certificates?: Json
          company_id?: string
          created_at?: string
          disputes_lost?: number
          installation_offered?: boolean
          min_order_eur?: number
          on_time_rate?: number | null
          pro_subscription?: boolean
          product_feed_url?: string | null
          regions_served?: string[]
          response_rate?: number | null
          review_count?: number
          service_area?: string[]
          typical_lead_time_days?: number | null
          updated_at?: string
          warehouse_locations?: Json
          warranty_months?: number | null
          weekly_capacity?: Json
        }
        Relationships: [
          {
            foreignKeyName: "supplier_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_jobs: {
        Row: {
          attempts: number
          created_at: string
          id: string
          job: string
          result: Json | null
          run_after: string
          status: string
          target_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          job: string
          result?: Json | null
          run_after?: string
          status?: string
          target_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          job?: string
          result?: Json | null
          run_after?: string
          status?: string
          target_id?: string | null
        }
        Relationships: []
      }
      tracking_events: {
        Row: {
          created_at: string
          description: string | null
          id: string
          location: string | null
          occurred_at: string
          shipment_id: string
          source: string
          status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          occurred_at?: string
          shipment_id: string
          source: string
          status: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          occurred_at?: string
          shipment_id?: string
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      trust_scores: {
        Row: {
          breakdown: Json
          company_id: string
          computed_at: string
          public_data_date: string | null
          score: number
        }
        Insert: {
          breakdown?: Json
          company_id: string
          computed_at?: string
          public_data_date?: string | null
          score: number
        }
        Update: {
          breakdown?: Json
          company_id?: string
          computed_at?: string
          public_data_date?: string | null
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "trust_scores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
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
      webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_type: string
          external_id: string | null
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          signature_valid: boolean
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type: string
          external_id?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          provider: string
          signature_valid?: boolean
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string
          external_id?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          signature_valid?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      price_index: {
        Row: {
          avg_unit_price: number | null
          category_id: string | null
          max: number | null
          min: number | null
          month: string | null
          region: string | null
          sample_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _add_quote_version: {
        Args: {
          _offer: Json
          _party: Database["public"]["Enums"]["offer_party"]
          _profile: string
          _quote: string
        }
        Returns: number
      }
      _close_pool: { Args: { _pool: string }; Returns: string }
      _driver_shipment: {
        Args: { _token: string }
        Returns: {
          carrier: string | null
          created_at: string
          driver_token: string | null
          eta: string | null
          id: string
          last_location: Json | null
          late_alerted_at: string | null
          lines: Json
          method: string
          order_id: string
          planned_date: string | null
          status: string
          tracking_number: string | null
        }
        SetofOptions: {
          from: "*"
          to: "shipments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _exec_job: { Args: { _job: string }; Returns: Json }
      _finalize_pool: { Args: { _pool: string }; Returns: undefined }
      _invite_supplier: {
        Args: {
          _claimed: boolean
          _rank: number
          _rfq: string
          _score: number
          _supplier: string
        }
        Returns: undefined
      }
      _my_supplier: { Args: never; Returns: string }
      _next_order_number: { Args: never; Returns: string }
      _notify_order: {
        Args: {
          _body: string
          _order: string
          _title: string
          _to_buyer: boolean
        }
        Returns: undefined
      }
      _open_agreement: { Args: { _quote: string }; Returns: string }
      _order_event: {
        Args: {
          _note: string
          _order: string
          _photos?: string[]
          _status: Database["public"]["Enums"]["order_status"]
        }
        Returns: undefined
      }
      _order_lines: { Args: { _order: string }; Returns: Json }
      _save_agreement_delivery: {
        Args: { _agreement: string; _details: Json }
        Returns: undefined
      }
      _shipment_event: {
        Args: {
          _desc: string
          _location: string
          _shipment: string
          _source: string
          _status: string
        }
        Returns: undefined
      }
      _supplier_offer: {
        Args: { _offer: Json; _profile: string; _rec: string }
        Returns: string
      }
      admin_order_commissions: {
        Args: never
        Returns: {
          buyer_name: string
          categories: string
          commission_amount: number
          commission_rate: number
          created_at: string
          order_id: string
          order_number: string
          status: Database["public"]["Enums"]["order_status"]
          supplier_name: string
          total: number
        }[]
      }
      admin_resolve_dispute: {
        Args: {
          _dispute: string
          _note: string
          _outcome: Database["public"]["Enums"]["dispute_status"]
          _refund: number
        }
        Returns: undefined
      }
      admin_set_category_commission: {
        Args: { _category: string; _rate: number }
        Returns: undefined
      }
      admin_set_integration: {
        Args: { _enabled: boolean; _mode: string; _service: string }
        Returns: undefined
      }
      admin_set_payment_deadline: {
        Args: { _minutes: number }
        Returns: undefined
      }
      admin_simulate_48h: { Args: never; Returns: Json }
      buyer_accept_delivery: { Args: { _order: string }; Returns: undefined }
      buyer_accept_quote: { Args: { _quote: string }; Returns: string }
      buyer_accept_quote_with_delivery: {
        Args: { _details: Json; _quote: string }
        Returns: string
      }
      buyer_approve_milestone: {
        Args: { _milestone: string }
        Returns: undefined
      }
      buyer_confirm_pickup: { Args: { _shipment: string }; Returns: undefined }
      buyer_counter_quote: {
        Args: { _offer: Json; _quote: string }
        Returns: number
      }
      buyer_dashboard: { Args: never; Returns: Json }
      buyer_open_dispute: {
        Args: {
          _description: string
          _held: number
          _order: string
          _photos?: string[]
          _reason: string
        }
        Returns: string
      }
      buyer_pay_balance: { Args: { _order: string }; Returns: undefined }
      buyer_pay_order: {
        Args: {
          _method: Database["public"]["Enums"]["payment_method"]
          _order: string
          _term_days?: number
        }
        Returns: undefined
      }
      buyer_reject_delivery_date: {
        Args: { _agreement: string; _latest: string; _reason: string }
        Returns: undefined
      }
      buyer_reject_quote: {
        Args: { _quote: string; _reason: string }
        Returns: undefined
      }
      buyer_save_agreement_delivery: {
        Args: { _agreement: string; _details: Json }
        Returns: undefined
      }
      buyer_sign_agreement: {
        Args: {
          _agreement: string
          _code: string
          _latest: string
          _note: string
        }
        Returns: string
      }
      calc_commission: {
        Args: { _buyer: string; _supplier: string; _version: string }
        Returns: {
          amount: number
          rate: number
        }[]
      }
      can_read_scan_photo: { Args: { _path: string }; Returns: boolean }
      cancel_agreement: { Args: { _agreement: string }; Returns: undefined }
      category_commission_rate: { Args: { _category: string }; Returns: number }
      choose_account_type: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      close_pool_now: { Args: { _pool: string }; Returns: string }
      compute_buyer_reliability: { Args: { _company: string }; Returns: number }
      compute_trust_score: { Args: { _company: string }; Returns: number }
      delivery_photo_party: { Args: { _folder: string }; Returns: boolean }
      driver_deliver: {
        Args: {
          _notes: string
          _photos: string[]
          _received: Json
          _receiver: string
          _signature: string
          _token: string
        }
        Returns: boolean
      }
      driver_get: { Args: { _token: string }; Returns: Json }
      driver_token_ok: { Args: { _token: string }; Returns: boolean }
      driver_update: {
        Args: { _lat?: number; _lng?: number; _status: string; _token: string }
        Returns: undefined
      }
      end_pool_window_now: { Args: { _pool: string }; Returns: undefined }
      enqueue_job: { Args: { _job: string; _target?: string }; Returns: string }
      expire_stale_quotes: { Args: never; Returns: number }
      expire_unpaid_orders: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invoice_detail: { Args: { _order: string }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      is_order_party: { Args: { _order: string }; Returns: boolean }
      is_rfq_buyer: { Args: { _rfq: string }; Returns: boolean }
      is_rfq_supplier: { Args: { _rfq: string }; Returns: boolean }
      job_backoff: { Args: { _attempts: number }; Returns: string }
      lens_suppliers: {
        Args: { _category_slug: string; _city: string }
        Returns: {
          city: string
          company_id: string
          country: string
          in_region: boolean
          lead_time_days: number
          match_score: number
          name: string
          price_updated_at: string
          product_currency: string
          product_name: string
          product_price: number
          product_stock: number
          trust_score: number
        }[]
      }
      magic_ask: { Args: { _body: string; _token: string }; Returns: undefined }
      magic_decline: {
        Args: {
          _message: string
          _reason: Database["public"]["Enums"]["decline_reason"]
          _token: string
        }
        Returns: undefined
      }
      magic_get: { Args: { _token: string }; Returns: Json }
      magic_quote_state: { Args: { _token: string }; Returns: Json }
      magic_send_quote: {
        Args: { _offer: Json; _token: string }
        Returns: string
      }
      mark_smart_id_verified: { Args: never; Returns: undefined }
      match_rfq: { Args: { _rfq: string }; Returns: number }
      my_company_id: { Args: never; Returns: string }
      my_invoices: {
        Args: never
        Returns: {
          commission_amount: number
          counterparty: string
          created_at: string
          order_id: string
          order_number: string
          paid: boolean
          payment_method: Database["public"]["Enums"]["payment_method"]
          side: string
          status: Database["public"]["Enums"]["order_status"]
          supplier_payout: number
          title: string
          total: number
        }[]
      }
      my_order_commission: {
        Args: { _order: string }
        Returns: {
          commission_amount: number
          commission_rate: number
          supplier_payout: number
        }[]
      }
      my_profile: { Args: never; Returns: Json }
      order_lines: { Args: { _order: string }; Returns: Json }
      payment_deadline_minutes: { Args: never; Returns: number }
      pool_confirm: { Args: { _code: string; _pool: string }; Returns: string }
      pool_join: {
        Args: { _if_fails?: string; _pool: string; _qty: number }
        Returns: undefined
      }
      pool_joined_qty: { Args: { _pool: string }; Returns: number }
      pool_leave: { Args: { _pool: string }; Returns: undefined }
      pool_owner: { Args: { _pool: string }; Returns: string }
      pool_tier_discount: {
        Args: { _qty: number; _tiers: Json }
        Returns: number
      }
      pool_totals: {
        Args: { _pool: string }
        Returns: {
          confirmed_qty: number
          members: number
          total_qty: number
        }[]
      }
      process_pools: { Args: never; Returns: number }
      process_rfq_timeouts: { Args: { _offset?: string }; Returns: Json }
      quote_rfq: { Args: { _quote: string }; Returns: string }
      quote_supplier: { Args: { _quote: string }; Returns: string }
      rank_rfq_candidates: {
        Args: { _rfq: string }
        Returns: {
          is_claimed: boolean
          match_score: number
          supplier_company_id: string
        }[]
      }
      recipient_supplier: { Args: { _rec: string }; Returns: string }
      recompute_all_scores: { Args: never; Returns: number }
      reroute_rfq: { Args: { _rfq: string }; Returns: string }
      reset_demo_data: { Args: never; Returns: Json }
      rfq_scan_photos: { Args: { _rfq: string }; Returns: string[] }
      run_sync_jobs: { Args: never; Returns: number }
      save_my_company: {
        Args: {
          _buyer_segment?: Database["public"]["Enums"]["buyer_segment"]
          _city: string
          _company_code: string
          _country?: string
          _name: string
        }
        Returns: string
      }
      save_my_default_delivery: { Args: { _details: Json }; Returns: undefined }
      save_my_profile: {
        Args: {
          _address: string
          _full_name: string
          _language: string
          _phone: string
          _vat_code: string
        }
        Returns: undefined
      }
      scheduler_tick: { Args: { _jobs: string[] }; Returns: number }
      seed_demo_base: { Args: never; Returns: Json }
      seed_demo_scored: { Args: never; Returns: Json }
      shipment_late_alerts: { Args: never; Returns: number }
      shipment_order: { Args: { _shipment: string }; Returns: string }
      sign_agreement: {
        Args: { _agreement: string; _code: string }
        Returns: string
      }
      supplier_accept_counter: { Args: { _rfq: string }; Returns: string }
      supplier_add_milestone: {
        Args: { _name: string; _order: string; _photos?: string[] }
        Returns: undefined
      }
      supplier_confirm_product: {
        Args: { _category: string; _id: string }
        Returns: undefined
      }
      supplier_create_shipment: {
        Args: {
          _carrier: string
          _lines?: Json
          _method: string
          _order: string
          _planned: string
          _tracking: string
        }
        Returns: string
      }
      supplier_dashboard: { Args: never; Returns: Json }
      supplier_decline_rfq: {
        Args: {
          _message: string
          _reason: Database["public"]["Enums"]["decline_reason"]
          _rfq: string
        }
        Returns: undefined
      }
      supplier_earnings: {
        Args: never
        Returns: {
          buyer_name: string
          commission_amount: number
          commission_rate: number
          created_at: string
          order_id: string
          order_number: string
          paid_out: boolean
          status: Database["public"]["Enums"]["order_status"]
          supplier_payout: number
          title: string
          total: number
        }[]
      }
      supplier_import_products: {
        Args: { _errors?: Json; _feed: string; _rows: Json }
        Returns: Json
      }
      supplier_integration_level: {
        Args: { _company: string }
        Returns: number
      }
      supplier_reject_counter: { Args: { _rfq: string }; Returns: undefined }
      supplier_save_feed: {
        Args: {
          _id: string
          _mapping: Json
          _schedule: string
          _secret_ref: string
          _type: string
          _url: string
        }
        Returns: string
      }
      supplier_send_quote: {
        Args: { _offer: Json; _rfq: string }
        Returns: string
      }
      supplier_sign_agreement: {
        Args: {
          _agreement: string
          _code: string
          _date: string
          _time: string
        }
        Returns: string
      }
      supplier_update_order: {
        Args: {
          _note: string
          _order: string
          _photos?: string[]
          _status: Database["public"]["Enums"]["order_status"]
        }
        Returns: undefined
      }
      supplier_update_shipment: {
        Args: { _desc?: string; _shipment: string; _status: string }
        Returns: undefined
      }
      supplier_view_rfq: { Args: { _rfq: string }; Returns: undefined }
    }
    Enums: {
      app_role: "buyer" | "supplier" | "admin"
      buyer_segment: "contractor" | "designer" | "business"
      company_type: "buyer" | "supplier"
      decline_reason:
        | "out_of_stock"
        | "cannot_meet_date"
        | "order_too_small"
        | "not_our_product"
        | "other"
      dispute_status:
        | "open"
        | "resolved_replacement"
        | "resolved_partial_refund"
        | "resolved_full_refund"
        | "rejected"
      offer_party: "buyer" | "supplier"
      order_status:
        | "created"
        | "awaiting_payment"
        | "paid_escrow"
        | "processing"
        | "shipped"
        | "in_transit"
        | "delivered"
        | "accepted"
        | "disputed"
        | "completed"
        | "cancelled"
      payment_method: "escrow" | "pay_later"
      payment_status:
        | "pending"
        | "held"
        | "partially_released"
        | "released"
        | "refunded"
        | "failed"
      pool_member_status:
        | "joined"
        | "left"
        | "confirmed"
        | "declined"
        | "no_response"
      pool_status: "open" | "closed" | "confirming" | "ordered" | "cancelled"
      project_type:
        | "new_construction"
        | "renovation"
        | "interior_design"
        | "business_fitout"
      quote_status:
        | "draft"
        | "sent"
        | "negotiating"
        | "accepted"
        | "rejected"
        | "expired"
        | "withdrawn"
      recipient_status:
        | "sent"
        | "viewed"
        | "declined"
        | "quoted"
        | "expired"
        | "rerouted"
        | "not_selected"
        | "selected"
      rfq_status:
        | "draft"
        | "submitted"
        | "matched"
        | "quotes_received"
        | "negotiating"
        | "closed"
        | "cancelled"
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
      app_role: ["buyer", "supplier", "admin"],
      buyer_segment: ["contractor", "designer", "business"],
      company_type: ["buyer", "supplier"],
      decline_reason: [
        "out_of_stock",
        "cannot_meet_date",
        "order_too_small",
        "not_our_product",
        "other",
      ],
      dispute_status: [
        "open",
        "resolved_replacement",
        "resolved_partial_refund",
        "resolved_full_refund",
        "rejected",
      ],
      offer_party: ["buyer", "supplier"],
      order_status: [
        "created",
        "awaiting_payment",
        "paid_escrow",
        "processing",
        "shipped",
        "in_transit",
        "delivered",
        "accepted",
        "disputed",
        "completed",
        "cancelled",
      ],
      payment_method: ["escrow", "pay_later"],
      payment_status: [
        "pending",
        "held",
        "partially_released",
        "released",
        "refunded",
        "failed",
      ],
      pool_member_status: [
        "joined",
        "left",
        "confirmed",
        "declined",
        "no_response",
      ],
      pool_status: ["open", "closed", "confirming", "ordered", "cancelled"],
      project_type: [
        "new_construction",
        "renovation",
        "interior_design",
        "business_fitout",
      ],
      quote_status: [
        "draft",
        "sent",
        "negotiating",
        "accepted",
        "rejected",
        "expired",
        "withdrawn",
      ],
      recipient_status: [
        "sent",
        "viewed",
        "declined",
        "quoted",
        "expired",
        "rerouted",
        "not_selected",
        "selected",
      ],
      rfq_status: [
        "draft",
        "submitted",
        "matched",
        "quotes_received",
        "negotiating",
        "closed",
        "cancelled",
      ],
    },
  },
} as const
