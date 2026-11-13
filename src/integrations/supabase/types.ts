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
          buyer_signature_code: string | null
          buyer_signed_at: string | null
          created_at: string
          delivery_date: string | null
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
          buyer_signature_code?: string | null
          buyer_signed_at?: string | null
          created_at?: string
          delivery_date?: string | null
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
          buyer_signature_code?: string | null
          buyer_signed_at?: string | null
          created_at?: string
          delivery_date?: string | null
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
          closed_qty: number | null
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
          closed_qty?: number | null
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
          closed_qty?: number | null
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
      messages: {
        Row: {
          attachments: string[]
          body: string
          contains_contact_info: boolean
          created_at: string
          id: string
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
          provider: string
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
          provider?: string
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
          provider?: string
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
      profiles: {
        Row: {
          city: string | null
          company_code: string | null
          company_id: string | null
          company_name: string | null
          country: string | null
          created_at: string
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
          description: string | null
          id: string
          max_suppliers: number
          min_trust_score: number
          negotiation_round_limit: number
          project_id: string | null
          project_type: Database["public"]["Enums"]["project_type"]
          rfq_number: string
          source: string
          status: Database["public"]["Enums"]["rfq_status"]
          submitted_at: string | null
          title: string
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
          description?: string | null
          id?: string
          max_suppliers?: number
          min_trust_score?: number
          negotiation_round_limit?: number
          project_id?: string | null
          project_type: Database["public"]["Enums"]["project_type"]
          rfq_number?: string
          source?: string
          status?: Database["public"]["Enums"]["rfq_status"]
          submitted_at?: string | null
          title: string
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
          description?: string | null
          id?: string
          max_suppliers?: number
          min_trust_score?: number
          negotiation_round_limit?: number
          project_id?: string | null
          project_type?: Database["public"]["Enums"]["project_type"]
          rfq_number?: string
          source?: string
          status?: Database["public"]["Enums"]["rfq_status"]
          submitted_at?: string | null
          title?: string
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
            foreignKeyName: "rfqs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      _open_agreement: { Args: { _quote: string }; Returns: string }
      _supplier_offer: {
        Args: { _offer: Json; _profile: string; _rec: string }
        Returns: string
      }
      admin_simulate_48h: { Args: never; Returns: Json }
      buyer_accept_quote: { Args: { _quote: string }; Returns: string }
      buyer_counter_quote: {
        Args: { _offer: Json; _quote: string }
        Returns: number
      }
      buyer_reject_quote: {
        Args: { _quote: string; _reason: string }
        Returns: undefined
      }
      calc_commission: {
        Args: { _buyer: string; _supplier: string; _version: string }
        Returns: {
          amount: number
          rate: number
        }[]
      }
      cancel_agreement: { Args: { _agreement: string }; Returns: undefined }
      choose_account_type: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      compute_buyer_reliability: { Args: { _company: string }; Returns: number }
      compute_trust_score: { Args: { _company: string }; Returns: number }
      expire_stale_quotes: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_order_party: { Args: { _order: string }; Returns: boolean }
      is_rfq_buyer: { Args: { _rfq: string }; Returns: boolean }
      is_rfq_supplier: { Args: { _rfq: string }; Returns: boolean }
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
      my_order_commission: {
        Args: { _order: string }
        Returns: {
          commission_amount: number
          commission_rate: number
          supplier_payout: number
        }[]
      }
      pool_joined_qty: { Args: { _pool: string }; Returns: number }
      pool_owner: { Args: { _pool: string }; Returns: string }
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
      seed_demo_base: { Args: never; Returns: Json }
      sign_agreement: {
        Args: { _agreement: string; _code: string }
        Returns: string
      }
      supplier_accept_counter: { Args: { _rfq: string }; Returns: string }
      supplier_decline_rfq: {
        Args: {
          _message: string
          _reason: Database["public"]["Enums"]["decline_reason"]
          _rfq: string
        }
        Returns: undefined
      }
      supplier_reject_counter: { Args: { _rfq: string }; Returns: undefined }
      supplier_send_quote: {
        Args: { _offer: Json; _rfq: string }
        Returns: string
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
