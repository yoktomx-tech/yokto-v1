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
      connected_accounts: {
        Row: {
          charges_enabled: boolean
          created_at: string
          id: string
          payouts_enabled: boolean
          provider: string
          provider_account_id: string | null
          requirements: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          charges_enabled?: boolean
          created_at?: string
          id?: string
          payouts_enabled?: boolean
          provider?: string
          provider_account_id?: string | null
          requirements?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          charges_enabled?: boolean
          created_at?: string
          id?: string
          payouts_enabled?: boolean
          provider?: string
          provider_account_id?: string | null
          requirements?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kyc_documents: {
        Row: {
          created_at: string
          document_type: Database["public"]["Enums"]["kyc_document_type"]
          file_name: string | null
          id: string
          mime_type: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["kyc_status"]
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type: Database["public"]["Enums"]["kyc_document_type"]
          file_name?: string | null
          id?: string
          mime_type?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_type?: Database["public"]["Enums"]["kyc_document_type"]
          file_name?: string | null
          id?: string
          mime_type?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_intents: {
        Row: {
          amount_cents: number
          clabe: string | null
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          metadata: Json
          method: string
          paid_at: string | null
          provider: string
          provider_ref: string | null
          reference_code: string | null
          status: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          clabe?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          method: string
          paid_at?: string | null
          provider?: string
          provider_ref?: string | null
          reference_code?: string | null
          status?: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          clabe?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          method?: string
          paid_at?: string | null
          provider?: string
          provider_ref?: string | null
          reference_code?: string | null
          status?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          commission_cents: number
          created_at: string
          currency: string
          gross_cents: number
          id: string
          metadata: Json
          net_cents: number
          paid_at: string | null
          provider: string
          provider_ref: string | null
          seller_id: string | null
          status: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          commission_cents?: number
          created_at?: string
          currency?: string
          gross_cents: number
          id?: string
          metadata?: Json
          net_cents: number
          paid_at?: string | null
          provider?: string
          provider_ref?: string | null
          seller_id?: string | null
          status?: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          commission_cents?: number
          created_at?: string
          currency?: string
          gross_cents?: number
          id?: string
          metadata?: Json
          net_cents?: number
          paid_at?: string | null
          provider?: string
          provider_ref?: string | null
          seller_id?: string | null
          status?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"] | null
          avatar_url: string | null
          created_at: string
          email: string | null
          first_name: string | null
          fiscal_address: string | null
          fiscal_postal_code: string | null
          id: string
          industry_sector: Database["public"]["Enums"]["industry_sector"] | null
          kyc_completed_at: string | null
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          kyc_submitted_at: string | null
          last_name: string | null
          legal_name: string | null
          onboarding_completed: boolean
          onboarding_step: number
          phone: string | null
          regimen_fiscal: string | null
          rfc: string | null
          updated_at: string
          uso_cfdi: string | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"] | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          fiscal_address?: string | null
          fiscal_postal_code?: string | null
          id: string
          industry_sector?:
            | Database["public"]["Enums"]["industry_sector"]
            | null
          kyc_completed_at?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          kyc_submitted_at?: string | null
          last_name?: string | null
          legal_name?: string | null
          onboarding_completed?: boolean
          onboarding_step?: number
          phone?: string | null
          regimen_fiscal?: string | null
          rfc?: string | null
          updated_at?: string
          uso_cfdi?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"] | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          fiscal_address?: string | null
          fiscal_postal_code?: string | null
          id?: string
          industry_sector?:
            | Database["public"]["Enums"]["industry_sector"]
            | null
          kyc_completed_at?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          kyc_submitted_at?: string | null
          last_name?: string | null
          legal_name?: string | null
          onboarding_completed?: boolean
          onboarding_step?: number
          phone?: string | null
          regimen_fiscal?: string | null
          rfc?: string | null
          updated_at?: string
          uso_cfdi?: string | null
        }
        Relationships: []
      }
      transaction_conditions: {
        Row: {
          created_at: string
          description: string
          evidence_url: string | null
          id: string
          met_at: string | null
          position: number
          status: Database["public"]["Enums"]["condition_status"]
          transaction_id: string
          updated_at: string
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          description: string
          evidence_url?: string | null
          id?: string
          met_at?: string | null
          position?: number
          status?: Database["public"]["Enums"]["condition_status"]
          transaction_id: string
          updated_at?: string
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          evidence_url?: string | null
          id?: string
          met_at?: string | null
          position?: number
          status?: Database["public"]["Enums"]["condition_status"]
          transaction_id?: string
          updated_at?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_conditions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          transaction_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          transaction_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount_cents: number
          buyer_id: string
          cancelled_at: string | null
          commission_bps: number
          commission_payer: Database["public"]["Enums"]["commission_payer"]
          counterparty_email: string | null
          created_at: string
          currency: string
          delivery_deadline: string | null
          description: string | null
          funded_at: string | null
          funding_deadline: string | null
          id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          released_at: string | null
          sector: string | null
          seller_id: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          title: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          buyer_id: string
          cancelled_at?: string | null
          commission_bps?: number
          commission_payer?: Database["public"]["Enums"]["commission_payer"]
          counterparty_email?: string | null
          created_at?: string
          currency?: string
          delivery_deadline?: string | null
          description?: string | null
          funded_at?: string | null
          funding_deadline?: string | null
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          released_at?: string | null
          sector?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          title: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          buyer_id?: string
          cancelled_at?: string | null
          commission_bps?: number
          commission_payer?: Database["public"]["Enums"]["commission_payer"]
          counterparty_email?: string | null
          created_at?: string
          currency?: string
          delivery_deadline?: string | null
          description?: string | null
          funded_at?: string | null
          funding_deadline?: string | null
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          released_at?: string | null
          sector?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      account_type: "persona_fisica" | "persona_moral"
      app_role: "buyer" | "seller" | "admin" | "verifier" | "mediator"
      commission_payer: "buyer" | "seller" | "split"
      condition_status: "pending" | "met" | "rejected"
      industry_sector:
        | "autotransporte"
        | "construccion"
        | "inmobiliario"
        | "vehiculos"
        | "servicios_profesionales"
        | "comercio"
        | "manufactura"
        | "otro"
      kyc_document_type:
        | "ine"
        | "passport"
        | "proof_of_address"
        | "acta_constitutiva"
        | "constancia_fiscal"
        | "poder_notarial"
        | "other"
      kyc_status: "pending" | "in_review" | "approved" | "rejected"
      payment_method: "spei" | "card"
      transaction_status:
        | "draft"
        | "awaiting_funding"
        | "funded"
        | "in_progress"
        | "conditions_met"
        | "released"
        | "disputed"
        | "cancelled"
        | "refunded"
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
      account_type: ["persona_fisica", "persona_moral"],
      app_role: ["buyer", "seller", "admin", "verifier", "mediator"],
      commission_payer: ["buyer", "seller", "split"],
      condition_status: ["pending", "met", "rejected"],
      industry_sector: [
        "autotransporte",
        "construccion",
        "inmobiliario",
        "vehiculos",
        "servicios_profesionales",
        "comercio",
        "manufactura",
        "otro",
      ],
      kyc_document_type: [
        "ine",
        "passport",
        "proof_of_address",
        "acta_constitutiva",
        "constancia_fiscal",
        "poder_notarial",
        "other",
      ],
      kyc_status: ["pending", "in_review", "approved", "rejected"],
      payment_method: ["spei", "card"],
      transaction_status: [
        "draft",
        "awaiting_funding",
        "funded",
        "in_progress",
        "conditions_met",
        "released",
        "disputed",
        "cancelled",
        "refunded",
      ],
    },
  },
} as const
