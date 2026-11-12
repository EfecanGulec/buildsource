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
          logo_url?: string | null
          name?: string
          type?: Database["public"]["Enums"]["company_type"]
          updated_at?: string
          vat_code?: string | null
          website?: string | null
        }
        Relationships: []
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
      choose_account_type: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_smart_id_verified: { Args: never; Returns: undefined }
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
    }
    Enums: {
      app_role: "buyer" | "supplier" | "admin"
      buyer_segment: "contractor" | "designer" | "business"
      company_type: "buyer" | "supplier"
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
    },
  },
} as const
