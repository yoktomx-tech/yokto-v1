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
      api_clients: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key_id: string
          last_used_at: string | null
          name: string
          owner_id: string
          scopes: string[]
          secret_hash: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key_id: string
          last_used_at?: string | null
          name: string
          owner_id: string
          scopes?: string[]
          secret_hash: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key_id?: string
          last_used_at?: string | null
          name?: string
          owner_id?: string
          scopes?: string[]
          secret_hash?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          new_data: Json | null
          previous_data: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          new_data?: Json | null
          previous_data?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          new_data?: Json | null
          previous_data?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      clabe_verifications: {
        Row: {
          banco: string | null
          clabe: string
          created_at: string
          id: string
          nivel: Database["public"]["Enums"]["clabe_nivel"]
          penny_test_amount_cents: number | null
          penny_test_code: string | null
          penny_test_confirmed_at: string | null
          penny_test_ref: string | null
          status: Database["public"]["Enums"]["clabe_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          banco?: string | null
          clabe: string
          created_at?: string
          id?: string
          nivel?: Database["public"]["Enums"]["clabe_nivel"]
          penny_test_amount_cents?: number | null
          penny_test_code?: string | null
          penny_test_confirmed_at?: string | null
          penny_test_ref?: string | null
          status?: Database["public"]["Enums"]["clabe_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          banco?: string | null
          clabe?: string
          created_at?: string
          id?: string
          nivel?: Database["public"]["Enums"]["clabe_nivel"]
          penny_test_amount_cents?: number | null
          penny_test_code?: string | null
          penny_test_confirmed_at?: string | null
          penny_test_ref?: string | null
          status?: Database["public"]["Enums"]["clabe_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
      curp_verifications: {
        Row: {
          apellido_materno: string | null
          apellido_paterno: string | null
          codigo_mensaje: string | null
          codigo_validacion: string | null
          created_at: string
          curp: string
          datos_doc_probatorio: Json | null
          doc_probatorio: number | null
          estado_nacimiento: string | null
          estatus: string | null
          estatus_curp: string | null
          fecha_nacimiento: string | null
          id: string
          nombre: string | null
          pais_nacimiento: string | null
          provider: string
          raw_response: Json | null
          sexo: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          apellido_materno?: string | null
          apellido_paterno?: string | null
          codigo_mensaje?: string | null
          codigo_validacion?: string | null
          created_at?: string
          curp: string
          datos_doc_probatorio?: Json | null
          doc_probatorio?: number | null
          estado_nacimiento?: string | null
          estatus?: string | null
          estatus_curp?: string | null
          fecha_nacimiento?: string | null
          id?: string
          nombre?: string | null
          pais_nacimiento?: string | null
          provider?: string
          raw_response?: Json | null
          sexo?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          apellido_materno?: string | null
          apellido_paterno?: string | null
          codigo_mensaje?: string | null
          codigo_validacion?: string | null
          created_at?: string
          curp?: string
          datos_doc_probatorio?: Json | null
          doc_probatorio?: number | null
          estado_nacimiento?: string | null
          estatus?: string | null
          estatus_curp?: string | null
          fecha_nacimiento?: string | null
          id?: string
          nombre?: string | null
          pais_nacimiento?: string | null
          provider?: string
          raw_response?: Json | null
          sexo?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dispute_messages: {
        Row: {
          author_id: string
          author_role: string
          body: string
          created_at: string
          dispute_id: string
          evidence_urls: string[]
          id: string
        }
        Insert: {
          author_id: string
          author_role: string
          body: string
          created_at?: string
          dispute_id: string
          evidence_urls?: string[]
          id?: string
        }
        Update: {
          author_id?: string
          author_role?: string
          body?: string
          created_at?: string
          dispute_id?: string
          evidence_urls?: string[]
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_messages_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          amount_disputed_cents: number
          buyer_share_cents: number | null
          created_at: string
          id: string
          loser_pays: string | null
          mediator_id: string | null
          opened_by: string
          opened_role: string
          reason_code: string
          reason_description: string
          resolution: string | null
          resolution_notes: string | null
          resolved_at: string | null
          seller_share_cents: number | null
          status: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          amount_disputed_cents: number
          buyer_share_cents?: number | null
          created_at?: string
          id?: string
          loser_pays?: string | null
          mediator_id?: string | null
          opened_by: string
          opened_role: string
          reason_code: string
          reason_description: string
          resolution?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          seller_share_cents?: number | null
          status?: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          amount_disputed_cents?: number
          buyer_share_cents?: number | null
          created_at?: string
          id?: string
          loser_pays?: string | null
          mediator_id?: string | null
          opened_by?: string
          opened_role?: string
          reason_code?: string
          reason_description?: string
          resolution?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          seller_share_cents?: number | null
          status?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
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
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          metadata: Json
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string
          type?: string
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
          birth_date: string | null
          created_at: string
          curp: string | null
          email: string | null
          first_name: string | null
          fiscal_address: string | null
          fiscal_colonia: string | null
          fiscal_estado: string | null
          fiscal_ext_number: string | null
          fiscal_int_number: string | null
          fiscal_municipio: string | null
          fiscal_postal_code: string | null
          fiscal_street: string | null
          id: string
          incorporation_date: string | null
          industry_sector: Database["public"]["Enums"]["industry_sector"] | null
          kyc_approved_at: string | null
          kyc_completed_at: string | null
          kyc_nivel: Database["public"]["Enums"]["kyc_nivel"]
          kyc_rejection_reason: string | null
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          kyc_submitted_at: string | null
          last_name: string | null
          legal_name: string | null
          legal_rep: Json | null
          onboarding_completed: boolean
          onboarding_step: number
          phone: string | null
          regimen_fiscal: string | null
          rfc: string | null
          second_last_name: string | null
          trade_name: string | null
          updated_at: string
          uso_cfdi: string | null
          uso_cfdi_default: string | null
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"] | null
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          curp?: string | null
          email?: string | null
          first_name?: string | null
          fiscal_address?: string | null
          fiscal_colonia?: string | null
          fiscal_estado?: string | null
          fiscal_ext_number?: string | null
          fiscal_int_number?: string | null
          fiscal_municipio?: string | null
          fiscal_postal_code?: string | null
          fiscal_street?: string | null
          id: string
          incorporation_date?: string | null
          industry_sector?:
            | Database["public"]["Enums"]["industry_sector"]
            | null
          kyc_approved_at?: string | null
          kyc_completed_at?: string | null
          kyc_nivel?: Database["public"]["Enums"]["kyc_nivel"]
          kyc_rejection_reason?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          kyc_submitted_at?: string | null
          last_name?: string | null
          legal_name?: string | null
          legal_rep?: Json | null
          onboarding_completed?: boolean
          onboarding_step?: number
          phone?: string | null
          regimen_fiscal?: string | null
          rfc?: string | null
          second_last_name?: string | null
          trade_name?: string | null
          updated_at?: string
          uso_cfdi?: string | null
          uso_cfdi_default?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"] | null
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          curp?: string | null
          email?: string | null
          first_name?: string | null
          fiscal_address?: string | null
          fiscal_colonia?: string | null
          fiscal_estado?: string | null
          fiscal_ext_number?: string | null
          fiscal_int_number?: string | null
          fiscal_municipio?: string | null
          fiscal_postal_code?: string | null
          fiscal_street?: string | null
          id?: string
          incorporation_date?: string | null
          industry_sector?:
            | Database["public"]["Enums"]["industry_sector"]
            | null
          kyc_approved_at?: string | null
          kyc_completed_at?: string | null
          kyc_nivel?: Database["public"]["Enums"]["kyc_nivel"]
          kyc_rejection_reason?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          kyc_submitted_at?: string | null
          last_name?: string | null
          legal_name?: string | null
          legal_rep?: Json | null
          onboarding_completed?: boolean
          onboarding_step?: number
          phone?: string | null
          regimen_fiscal?: string | null
          rfc?: string | null
          second_last_name?: string | null
          trade_name?: string | null
          updated_at?: string
          uso_cfdi?: string | null
          uso_cfdi_default?: string | null
        }
        Relationships: []
      }
      reports_ledger: {
        Row: {
          created_at: string
          id: string
          kind: string
          metadata: Json | null
          owner_id: string
          period_from: string | null
          period_to: string | null
          row_count: number | null
          transaction_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          metadata?: Json | null
          owner_id: string
          period_from?: string | null
          period_to?: string | null
          row_count?: number | null
          transaction_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json | null
          owner_id?: string
          period_from?: string | null
          period_to?: string | null
          row_count?: number | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_ledger_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
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
      verification_evidence: {
        Row: {
          ai_model: string | null
          ai_provider: string | null
          ai_raw: Json | null
          ai_score: number | null
          ai_summary: string | null
          ai_verdict: string | null
          analyzed_at: string | null
          created_at: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          note: string | null
          size_bytes: number | null
          transaction_id: string
          uploaded_by: string
        }
        Insert: {
          ai_model?: string | null
          ai_provider?: string | null
          ai_raw?: Json | null
          ai_score?: number | null
          ai_summary?: string | null
          ai_verdict?: string | null
          analyzed_at?: string | null
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          note?: string | null
          size_bytes?: number | null
          transaction_id: string
          uploaded_by: string
        }
        Update: {
          ai_model?: string | null
          ai_provider?: string | null
          ai_raw?: Json | null
          ai_score?: number | null
          ai_summary?: string | null
          ai_verdict?: string | null
          analyzed_at?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          note?: string | null
          size_bytes?: number | null
          transaction_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_evidence_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
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
      clabe_nivel: "algoritmica" | "penny_test" | "documental"
      clabe_status: "pending" | "verifying" | "verified" | "failed"
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
        | "ine_frente"
        | "ine_reverso"
        | "selfie_con_id"
        | "cedula_fiscal"
      kyc_nivel: "basico" | "intermedio" | "avanzado"
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
      clabe_nivel: ["algoritmica", "penny_test", "documental"],
      clabe_status: ["pending", "verifying", "verified", "failed"],
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
        "ine_frente",
        "ine_reverso",
        "selfie_con_id",
        "cedula_fiscal",
      ],
      kyc_nivel: ["basico", "intermedio", "avanzado"],
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
