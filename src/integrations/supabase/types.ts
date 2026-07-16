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
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          org_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          org_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          org_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      bank_account_penny_tests: {
        Row: {
          bank_account_id: string
          created_at: string
          decision_reasons: string[] | null
          finished_at: string | null
          id: string
          name_receiver: string | null
          name_similarity: number | null
          provider: string
          provider_status: string | null
          provider_uuid: string
          query_masked: string
          raw_response: Json | null
          rfc_curp_match: string | null
          rfc_curp_receiver: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
          webhook_events: Json
        }
        Insert: {
          bank_account_id: string
          created_at?: string
          decision_reasons?: string[] | null
          finished_at?: string | null
          id?: string
          name_receiver?: string | null
          name_similarity?: number | null
          provider?: string
          provider_status?: string | null
          provider_uuid: string
          query_masked: string
          raw_response?: Json | null
          rfc_curp_match?: string | null
          rfc_curp_receiver?: string | null
          status?: string
          type: string
          updated_at?: string
          user_id: string
          webhook_events?: Json
        }
        Update: {
          bank_account_id?: string
          created_at?: string
          decision_reasons?: string[] | null
          finished_at?: string | null
          id?: string
          name_receiver?: string | null
          name_similarity?: number | null
          provider?: string
          provider_status?: string | null
          provider_uuid?: string
          query_masked?: string
          raw_response?: Json | null
          rfc_curp_match?: string | null
          rfc_curp_receiver?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
          webhook_events?: Json
        }
        Relationships: [
          {
            foreignKeyName: "bank_account_penny_tests_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_type: string
          archived_at: string | null
          bank_institution_clave: string | null
          bank_name: string | null
          can_receive_payouts: boolean
          can_receive_refunds: boolean
          created_at: string
          created_by: string
          holder_expected_curp: string | null
          holder_expected_name: string
          holder_expected_rfc: string | null
          id: string
          is_primary: boolean
          owner_org_id: string | null
          owner_user_id: string | null
          query_hash: string
          query_last4: string
          query_masked: string
          reviewed_at: string | null
          reviewed_by: string | null
          updated_at: string
          verification_status: string
        }
        Insert: {
          account_type: string
          archived_at?: string | null
          bank_institution_clave?: string | null
          bank_name?: string | null
          can_receive_payouts?: boolean
          can_receive_refunds?: boolean
          created_at?: string
          created_by: string
          holder_expected_curp?: string | null
          holder_expected_name: string
          holder_expected_rfc?: string | null
          id?: string
          is_primary?: boolean
          owner_org_id?: string | null
          owner_user_id?: string | null
          query_hash: string
          query_last4: string
          query_masked: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
          verification_status?: string
        }
        Update: {
          account_type?: string
          archived_at?: string | null
          bank_institution_clave?: string | null
          bank_name?: string | null
          can_receive_payouts?: boolean
          can_receive_refunds?: boolean
          created_at?: string
          created_by?: string
          holder_expected_curp?: string | null
          holder_expected_name?: string
          holder_expected_rfc?: string | null
          id?: string
          is_primary?: boolean
          owner_org_id?: string | null
          owner_user_id?: string | null
          query_hash?: string
          query_last4?: string
          query_masked?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_owner_org_id_fkey"
            columns: ["owner_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      biometric_api_logs: {
        Row: {
          created_at: string
          endpoint: string
          enrollment_id: string | null
          error_message: string | null
          http_status: number | null
          id: string
          ok: boolean
          provider: string
          request_summary: Json | null
          response_summary: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          enrollment_id?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          ok?: boolean
          provider?: string
          request_summary?: Json | null
          response_summary?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          enrollment_id?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          ok?: boolean
          provider?: string
          request_summary?: Json | null
          response_summary?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "biometric_api_logs_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "biometric_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      biometric_enrollments: {
        Row: {
          address_doc_data: Json | null
          address_doc_issued_at: string | null
          address_doc_ok: boolean | null
          address_doc_path: string | null
          address_doc_type: string | null
          completed_at: string | null
          created_at: string
          curp_match: boolean | null
          curp_renapo_data: Json | null
          expires_at: string
          face_match_ok: boolean | null
          face_score: number | null
          id: string
          id_back_path: string | null
          id_front_path: string | null
          id_type: string | null
          last_error: string | null
          lista_nominal_data: Json | null
          lista_nominal_ok: boolean | null
          ocr_curp: string | null
          ocr_data: Json | null
          selfie_path: string | null
          status: string
          token: string
          updated_at: string
          user_id: string
          video_path: string | null
        }
        Insert: {
          address_doc_data?: Json | null
          address_doc_issued_at?: string | null
          address_doc_ok?: boolean | null
          address_doc_path?: string | null
          address_doc_type?: string | null
          completed_at?: string | null
          created_at?: string
          curp_match?: boolean | null
          curp_renapo_data?: Json | null
          expires_at: string
          face_match_ok?: boolean | null
          face_score?: number | null
          id?: string
          id_back_path?: string | null
          id_front_path?: string | null
          id_type?: string | null
          last_error?: string | null
          lista_nominal_data?: Json | null
          lista_nominal_ok?: boolean | null
          ocr_curp?: string | null
          ocr_data?: Json | null
          selfie_path?: string | null
          status?: string
          token: string
          updated_at?: string
          user_id: string
          video_path?: string | null
        }
        Update: {
          address_doc_data?: Json | null
          address_doc_issued_at?: string | null
          address_doc_ok?: boolean | null
          address_doc_path?: string | null
          address_doc_type?: string | null
          completed_at?: string | null
          created_at?: string
          curp_match?: boolean | null
          curp_renapo_data?: Json | null
          expires_at?: string
          face_match_ok?: boolean | null
          face_score?: number | null
          id?: string
          id_back_path?: string | null
          id_front_path?: string | null
          id_type?: string | null
          last_error?: string | null
          lista_nominal_data?: Json | null
          lista_nominal_ok?: boolean | null
          ocr_curp?: string | null
          ocr_data?: Json | null
          selfie_path?: string | null
          status?: string
          token?: string
          updated_at?: string
          user_id?: string
          video_path?: string | null
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
      contract_signatures: {
        Row: {
          biometric_liveness_score: number | null
          biometric_match_score: number | null
          biometric_provider: string | null
          biometric_selfie_path: string | null
          contract_id: string
          created_at: string
          document_hash_sha256: string
          efirma_algorithm: string | null
          efirma_certificate_curp: string | null
          efirma_certificate_rfc: string | null
          efirma_certificate_serial: string | null
          efirma_certificate_valid_from: string | null
          efirma_certificate_valid_to: string | null
          efirma_signature_b64: string | null
          evidence: Json | null
          geo_lat: number | null
          geo_lng: number | null
          id: string
          ip_address: unknown
          method: string
          signature_png_path: string | null
          signature_svg_path: string | null
          signed_at: string | null
          signer_name: string
          signer_rfc: string | null
          signer_role: string
          signer_user_id: string
          status: string
          transaction_id: string
          user_agent: string | null
        }
        Insert: {
          biometric_liveness_score?: number | null
          biometric_match_score?: number | null
          biometric_provider?: string | null
          biometric_selfie_path?: string | null
          contract_id: string
          created_at?: string
          document_hash_sha256: string
          efirma_algorithm?: string | null
          efirma_certificate_curp?: string | null
          efirma_certificate_rfc?: string | null
          efirma_certificate_serial?: string | null
          efirma_certificate_valid_from?: string | null
          efirma_certificate_valid_to?: string | null
          efirma_signature_b64?: string | null
          evidence?: Json | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          ip_address?: unknown
          method: string
          signature_png_path?: string | null
          signature_svg_path?: string | null
          signed_at?: string | null
          signer_name: string
          signer_rfc?: string | null
          signer_role: string
          signer_user_id: string
          status?: string
          transaction_id: string
          user_agent?: string | null
        }
        Update: {
          biometric_liveness_score?: number | null
          biometric_match_score?: number | null
          biometric_provider?: string | null
          biometric_selfie_path?: string | null
          contract_id?: string
          created_at?: string
          document_hash_sha256?: string
          efirma_algorithm?: string | null
          efirma_certificate_curp?: string | null
          efirma_certificate_rfc?: string | null
          efirma_certificate_serial?: string | null
          efirma_certificate_valid_from?: string | null
          efirma_certificate_valid_to?: string | null
          efirma_signature_b64?: string | null
          evidence?: Json | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          ip_address?: unknown
          method?: string
          signature_png_path?: string | null
          signature_svg_path?: string | null
          signed_at?: string | null
          signer_name?: string
          signer_rfc?: string | null
          signer_role?: string
          signer_user_id?: string
          status?: string
          transaction_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "transaction_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signatures_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
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
      dispute_evidence: {
        Row: {
          created_at: string
          description: string
          dispute_id: string
          id: string
          kind: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_by: string
          uploader_role: string
        }
        Insert: {
          created_at?: string
          description: string
          dispute_id: string
          id?: string
          kind: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_by: string
          uploader_role: string
        }
        Update: {
          created_at?: string
          description?: string
          dispute_id?: string
          id?: string
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string
          uploader_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_evidence_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_messages: {
        Row: {
          attachments: Json
          author_id: string
          author_role: string
          body: string
          created_at: string
          dispute_id: string
          evidence_urls: string[]
          id: string
          message_type: string
          read_by_buyer: boolean
          read_by_mediator: boolean
          read_by_seller: boolean
          visible_to: string
        }
        Insert: {
          attachments?: Json
          author_id: string
          author_role: string
          body: string
          created_at?: string
          dispute_id: string
          evidence_urls?: string[]
          id?: string
          message_type?: string
          read_by_buyer?: boolean
          read_by_mediator?: boolean
          read_by_seller?: boolean
          visible_to?: string
        }
        Update: {
          attachments?: Json
          author_id?: string
          author_role?: string
          body?: string
          created_at?: string
          dispute_id?: string
          evidence_urls?: string[]
          id?: string
          message_type?: string
          read_by_buyer?: boolean
          read_by_mediator?: boolean
          read_by_seller?: boolean
          visible_to?: string
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
          activated_at: string | null
          amount_disputed_cents: number
          arbitration_case_number: string | null
          arbitration_entity: string | null
          buyer_share_cents: number | null
          counterparty_response_due_at: string | null
          created_at: string
          deposit_cents: number | null
          deposit_distribution: Json | null
          deposit_paid: boolean
          deposit_paid_at: string | null
          deposit_provider_ref: string | null
          deposit_returned_to: string | null
          escalated_at: string | null
          escalation_reason: string | null
          evidence_closed_at: string | null
          evidence_due_at: string | null
          hito_id: string | null
          id: string
          loser_pays: string | null
          mediator_id: string | null
          numero: string | null
          opened_by: string
          opened_role: string
          percent_release_seller: number | null
          reason_code: string
          reason_description: string
          resolution: string | null
          resolution_due_at: string | null
          resolution_notes: string | null
          resolved_at: string | null
          seller_share_cents: number | null
          status: string
          summary_ai: string | null
          summary_ai_generated_at: string | null
          transaction_id: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          amount_disputed_cents: number
          arbitration_case_number?: string | null
          arbitration_entity?: string | null
          buyer_share_cents?: number | null
          counterparty_response_due_at?: string | null
          created_at?: string
          deposit_cents?: number | null
          deposit_distribution?: Json | null
          deposit_paid?: boolean
          deposit_paid_at?: string | null
          deposit_provider_ref?: string | null
          deposit_returned_to?: string | null
          escalated_at?: string | null
          escalation_reason?: string | null
          evidence_closed_at?: string | null
          evidence_due_at?: string | null
          hito_id?: string | null
          id?: string
          loser_pays?: string | null
          mediator_id?: string | null
          numero?: string | null
          opened_by: string
          opened_role: string
          percent_release_seller?: number | null
          reason_code: string
          reason_description: string
          resolution?: string | null
          resolution_due_at?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          seller_share_cents?: number | null
          status?: string
          summary_ai?: string | null
          summary_ai_generated_at?: string | null
          transaction_id: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          amount_disputed_cents?: number
          arbitration_case_number?: string | null
          arbitration_entity?: string | null
          buyer_share_cents?: number | null
          counterparty_response_due_at?: string | null
          created_at?: string
          deposit_cents?: number | null
          deposit_distribution?: Json | null
          deposit_paid?: boolean
          deposit_paid_at?: string | null
          deposit_provider_ref?: string | null
          deposit_returned_to?: string | null
          escalated_at?: string | null
          escalation_reason?: string | null
          evidence_closed_at?: string | null
          evidence_due_at?: string | null
          hito_id?: string | null
          id?: string
          loser_pays?: string | null
          mediator_id?: string | null
          numero?: string | null
          opened_by?: string
          opened_role?: string
          percent_release_seller?: number | null
          reason_code?: string
          reason_description?: string
          resolution?: string | null
          resolution_due_at?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          seller_share_cents?: number | null
          status?: string
          summary_ai?: string | null
          summary_ai_generated_at?: string | null
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_hito_id_fkey"
            columns: ["hito_id"]
            isOneToOne: false
            referencedRelation: "transaction_hitos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_documents: {
        Row: {
          aceptado_at: string | null
          aceptado_por: string | null
          ai_analysis: Json | null
          coherence_checks: Json | null
          coherence_score: number | null
          created_at: string
          descuento: number | null
          domicilio_fiscal_receptor: string | null
          estado: string
          estado_sat: string | null
          fecha_consulta_sat: string | null
          fecha_emision: string | null
          fecha_pago: string | null
          fecha_timbrado: string | null
          folio: string | null
          forma_pago: string | null
          hito_id: string | null
          id: string
          imp_pagado: number | null
          imp_saldo_ant: number | null
          imp_saldo_insoluto: number | null
          metodo_pago: string | null
          moneda: string | null
          motivo_rechazo: string | null
          no_certificado_emisor: string | null
          no_certificado_sat: string | null
          nombre_emisor: string | null
          nombre_receptor: string | null
          parcialidad_numero: number | null
          parent_cfdi_id: string | null
          pdf_url: string | null
          raw_xml_data: Json | null
          rechazado_at: string | null
          rechazado_por: string | null
          regimen_fiscal_emisor: string | null
          regimen_fiscal_receptor: string | null
          rep_data: Json | null
          rfc_emisor: string | null
          rfc_receptor: string | null
          sello_cfd: string | null
          sello_sat: string | null
          serie: string | null
          subtotal: number | null
          tipo: string
          tipo_cambio: number | null
          total: number | null
          total_impuestos_retenidos: number | null
          total_impuestos_trasladados: number | null
          transaction_id: string
          updated_at: string
          uploaded_by: string
          uso_cfdi: string | null
          uuid_fiscal: string | null
          validation_errors: Json | null
          validation_warnings: Json | null
          xml_hash: string | null
          xml_url: string
        }
        Insert: {
          aceptado_at?: string | null
          aceptado_por?: string | null
          ai_analysis?: Json | null
          coherence_checks?: Json | null
          coherence_score?: number | null
          created_at?: string
          descuento?: number | null
          domicilio_fiscal_receptor?: string | null
          estado?: string
          estado_sat?: string | null
          fecha_consulta_sat?: string | null
          fecha_emision?: string | null
          fecha_pago?: string | null
          fecha_timbrado?: string | null
          folio?: string | null
          forma_pago?: string | null
          hito_id?: string | null
          id?: string
          imp_pagado?: number | null
          imp_saldo_ant?: number | null
          imp_saldo_insoluto?: number | null
          metodo_pago?: string | null
          moneda?: string | null
          motivo_rechazo?: string | null
          no_certificado_emisor?: string | null
          no_certificado_sat?: string | null
          nombre_emisor?: string | null
          nombre_receptor?: string | null
          parcialidad_numero?: number | null
          parent_cfdi_id?: string | null
          pdf_url?: string | null
          raw_xml_data?: Json | null
          rechazado_at?: string | null
          rechazado_por?: string | null
          regimen_fiscal_emisor?: string | null
          regimen_fiscal_receptor?: string | null
          rep_data?: Json | null
          rfc_emisor?: string | null
          rfc_receptor?: string | null
          sello_cfd?: string | null
          sello_sat?: string | null
          serie?: string | null
          subtotal?: number | null
          tipo: string
          tipo_cambio?: number | null
          total?: number | null
          total_impuestos_retenidos?: number | null
          total_impuestos_trasladados?: number | null
          transaction_id: string
          updated_at?: string
          uploaded_by: string
          uso_cfdi?: string | null
          uuid_fiscal?: string | null
          validation_errors?: Json | null
          validation_warnings?: Json | null
          xml_hash?: string | null
          xml_url: string
        }
        Update: {
          aceptado_at?: string | null
          aceptado_por?: string | null
          ai_analysis?: Json | null
          coherence_checks?: Json | null
          coherence_score?: number | null
          created_at?: string
          descuento?: number | null
          domicilio_fiscal_receptor?: string | null
          estado?: string
          estado_sat?: string | null
          fecha_consulta_sat?: string | null
          fecha_emision?: string | null
          fecha_pago?: string | null
          fecha_timbrado?: string | null
          folio?: string | null
          forma_pago?: string | null
          hito_id?: string | null
          id?: string
          imp_pagado?: number | null
          imp_saldo_ant?: number | null
          imp_saldo_insoluto?: number | null
          metodo_pago?: string | null
          moneda?: string | null
          motivo_rechazo?: string | null
          no_certificado_emisor?: string | null
          no_certificado_sat?: string | null
          nombre_emisor?: string | null
          nombre_receptor?: string | null
          parcialidad_numero?: number | null
          parent_cfdi_id?: string | null
          pdf_url?: string | null
          raw_xml_data?: Json | null
          rechazado_at?: string | null
          rechazado_por?: string | null
          regimen_fiscal_emisor?: string | null
          regimen_fiscal_receptor?: string | null
          rep_data?: Json | null
          rfc_emisor?: string | null
          rfc_receptor?: string | null
          sello_cfd?: string | null
          sello_sat?: string | null
          serie?: string | null
          subtotal?: number | null
          tipo?: string
          tipo_cambio?: number | null
          total?: number | null
          total_impuestos_retenidos?: number | null
          total_impuestos_trasladados?: number | null
          transaction_id?: string
          updated_at?: string
          uploaded_by?: string
          uso_cfdi?: string | null
          uuid_fiscal?: string | null
          validation_errors?: Json | null
          validation_warnings?: Json | null
          xml_hash?: string | null
          xml_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_documents_hito_id_fkey"
            columns: ["hito_id"]
            isOneToOne: false
            referencedRelation: "transaction_hitos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documents_parent_cfdi_id_fkey"
            columns: ["parent_cfdi_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documents_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          org_id: string
          org_role: Database["public"]["Enums"]["org_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id: string
          org_role: Database["public"]["Enums"]["org_role"]
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id?: string
          org_role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      memberships: {
        Row: {
          created_at: string
          invited_by: string | null
          joined_at: string
          org_id: string
          org_role: Database["public"]["Enums"]["org_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          invited_by?: string | null
          joined_at?: string
          org_id: string
          org_role: Database["public"]["Enums"]["org_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          invited_by?: string | null
          joined_at?: string
          org_id?: string
          org_role?: Database["public"]["Enums"]["org_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      organizations: {
        Row: {
          created_at: string
          domicilio_fiscal: Json | null
          id: string
          kyb_status: Database["public"]["Enums"]["kyb_status"]
          name: string
          owner_user_id: string | null
          razon_social: string | null
          regimen_fiscal: string | null
          rfc: string | null
          slug: string | null
          type: Database["public"]["Enums"]["org_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          domicilio_fiscal?: Json | null
          id?: string
          kyb_status?: Database["public"]["Enums"]["kyb_status"]
          name: string
          owner_user_id?: string | null
          razon_social?: string | null
          regimen_fiscal?: string | null
          rfc?: string | null
          slug?: string | null
          type?: Database["public"]["Enums"]["org_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          domicilio_fiscal?: Json | null
          id?: string
          kyb_status?: Database["public"]["Enums"]["kyb_status"]
          name?: string
          owner_user_id?: string | null
          razon_social?: string | null
          regimen_fiscal?: string | null
          rfc?: string | null
          slug?: string | null
          type?: Database["public"]["Enums"]["org_type"]
          updated_at?: string
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
      platform_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["platform_role"]
          user_id?: string
        }
        Relationships: []
      }
      postal_code_lookups: {
        Row: {
          ciudad: string | null
          colonias: Json | null
          cp: string
          created_at: string
          error: string | null
          estado: string | null
          id: string
          municipio: string | null
          pais: string | null
          raw_response: Json | null
          source: string
          success: boolean
          user_id: string | null
        }
        Insert: {
          ciudad?: string | null
          colonias?: Json | null
          cp: string
          created_at?: string
          error?: string | null
          estado?: string | null
          id?: string
          municipio?: string | null
          pais?: string | null
          raw_response?: Json | null
          source?: string
          success?: boolean
          user_id?: string | null
        }
        Update: {
          ciudad?: string | null
          colonias?: Json | null
          cp?: string
          created_at?: string
          error?: string | null
          estado?: string | null
          id?: string
          municipio?: string | null
          pais?: string | null
          raw_response?: Json | null
          source?: string
          success?: boolean
          user_id?: string | null
        }
        Relationships: []
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
          mfa_status: string
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
          mfa_status?: string
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
          mfa_status?: string
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
      stripe_webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          received_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed?: boolean
          processed_at?: string | null
          received_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          received_at?: string
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
      transaction_contracts: {
        Row: {
          already_signed: boolean
          buyer_signature_method: string | null
          created_at: string
          created_by: string
          editable_sections: Json | null
          expires_at: string | null
          generated_payload: Json | null
          hash_original_sha256: string | null
          hash_signed_sha256: string | null
          id: string
          requires_buyer_signature: boolean
          requires_seller_signature: boolean
          requires_yokto_signature: boolean
          seller_signature_method: string | null
          signature_order: string
          source_type: string
          status: string
          storage_path_original: string | null
          storage_path_signed: string | null
          template_key: string | null
          title: string
          transaction_id: string
          updated_at: string
          version: string
        }
        Insert: {
          already_signed?: boolean
          buyer_signature_method?: string | null
          created_at?: string
          created_by: string
          editable_sections?: Json | null
          expires_at?: string | null
          generated_payload?: Json | null
          hash_original_sha256?: string | null
          hash_signed_sha256?: string | null
          id?: string
          requires_buyer_signature?: boolean
          requires_seller_signature?: boolean
          requires_yokto_signature?: boolean
          seller_signature_method?: string | null
          signature_order?: string
          source_type: string
          status?: string
          storage_path_original?: string | null
          storage_path_signed?: string | null
          template_key?: string | null
          title: string
          transaction_id: string
          updated_at?: string
          version?: string
        }
        Update: {
          already_signed?: boolean
          buyer_signature_method?: string | null
          created_at?: string
          created_by?: string
          editable_sections?: Json | null
          expires_at?: string | null
          generated_payload?: Json | null
          hash_original_sha256?: string | null
          hash_signed_sha256?: string | null
          id?: string
          requires_buyer_signature?: boolean
          requires_seller_signature?: boolean
          requires_yokto_signature?: boolean
          seller_signature_method?: string | null
          signature_order?: string
          source_type?: string
          status?: string
          storage_path_original?: string | null
          storage_path_signed?: string | null
          template_key?: string | null
          title?: string
          transaction_id?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_contracts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_documents: {
        Row: {
          cfdi_fecha: string | null
          cfdi_rfc_emisor: string | null
          cfdi_rfc_receptor: string | null
          cfdi_total_cents: number | null
          cfdi_uuid: string | null
          created_at: string
          doc_type: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          note: string | null
          sat_message: string | null
          sat_status: string | null
          size_bytes: number | null
          transaction_id: string
          updated_at: string
          uploaded_by: string
          validated_at: string | null
        }
        Insert: {
          cfdi_fecha?: string | null
          cfdi_rfc_emisor?: string | null
          cfdi_rfc_receptor?: string | null
          cfdi_total_cents?: number | null
          cfdi_uuid?: string | null
          created_at?: string
          doc_type: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          note?: string | null
          sat_message?: string | null
          sat_status?: string | null
          size_bytes?: number | null
          transaction_id: string
          updated_at?: string
          uploaded_by: string
          validated_at?: string | null
        }
        Update: {
          cfdi_fecha?: string | null
          cfdi_rfc_emisor?: string | null
          cfdi_rfc_receptor?: string | null
          cfdi_total_cents?: number | null
          cfdi_uuid?: string | null
          created_at?: string
          doc_type?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          note?: string | null
          sat_message?: string | null
          sat_status?: string | null
          size_bytes?: number | null
          transaction_id?: string
          updated_at?: string
          uploaded_by?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_documents_transaction_id_fkey"
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
      transaction_hitos: {
        Row: {
          aprobado_at: string | null
          aprobado_por: string | null
          auto_release: boolean
          created_at: string
          descripcion: string | null
          documentos_requeridos: string[]
          estado: string
          evidencia_requerida: string[]
          fecha_limite: string | null
          id: string
          liberacion_stripe_transfer_id: string | null
          monto_cents: number | null
          monto_porcentaje: number
          notas_rechazo: string | null
          orden: number
          responsable: string
          tipo_verificacion: string
          titulo: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          aprobado_at?: string | null
          aprobado_por?: string | null
          auto_release?: boolean
          created_at?: string
          descripcion?: string | null
          documentos_requeridos?: string[]
          estado?: string
          evidencia_requerida?: string[]
          fecha_limite?: string | null
          id?: string
          liberacion_stripe_transfer_id?: string | null
          monto_cents?: number | null
          monto_porcentaje: number
          notas_rechazo?: string | null
          orden: number
          responsable: string
          tipo_verificacion: string
          titulo: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          aprobado_at?: string | null
          aprobado_por?: string | null
          auto_release?: boolean
          created_at?: string
          descripcion?: string | null
          documentos_requeridos?: string[]
          estado?: string
          evidencia_requerida?: string[]
          fecha_limite?: string | null
          id?: string
          liberacion_stripe_transfer_id?: string | null
          monto_cents?: number | null
          monto_porcentaje?: number
          notas_rechazo?: string | null
          orden?: number
          responsable?: string
          tipo_verificacion?: string
          titulo?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_hitos_transaction_id_fkey"
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
          auto_release_global: boolean | null
          beneficiario_nombre: string | null
          buyer_id: string
          cancelled_at: string | null
          clabe_virtual: string | null
          comision_cents: number | null
          commission_bps: number
          commission_payer: Database["public"]["Enums"]["commission_payer"]
          contrato_pdf_url: string | null
          counterparty_email: string | null
          creado_por: string | null
          created_at: string
          currency: string
          delivery_deadline: string | null
          description: string | null
          descuento_volumetrico: number | null
          fecha_activacion: string | null
          fecha_cancelada: string | null
          fecha_completada: string | null
          fecha_firma_beneficiario: string | null
          fecha_firma_pagador: string | null
          funded_at: string | null
          funding_deadline: string | null
          id: string
          ip_creacion: unknown
          iva_comision_cents: number | null
          numero: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          released_at: string | null
          repse_requerido: boolean | null
          sector: string | null
          seller_id: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          stripe_payment_intent_id: string | null
          title: string
          total_a_depositar_cents: number | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          auto_release_global?: boolean | null
          beneficiario_nombre?: string | null
          buyer_id: string
          cancelled_at?: string | null
          clabe_virtual?: string | null
          comision_cents?: number | null
          commission_bps?: number
          commission_payer?: Database["public"]["Enums"]["commission_payer"]
          contrato_pdf_url?: string | null
          counterparty_email?: string | null
          creado_por?: string | null
          created_at?: string
          currency?: string
          delivery_deadline?: string | null
          description?: string | null
          descuento_volumetrico?: number | null
          fecha_activacion?: string | null
          fecha_cancelada?: string | null
          fecha_completada?: string | null
          fecha_firma_beneficiario?: string | null
          fecha_firma_pagador?: string | null
          funded_at?: string | null
          funding_deadline?: string | null
          id?: string
          ip_creacion?: unknown
          iva_comision_cents?: number | null
          numero?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          released_at?: string | null
          repse_requerido?: boolean | null
          sector?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          stripe_payment_intent_id?: string | null
          title: string
          total_a_depositar_cents?: number | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          auto_release_global?: boolean | null
          beneficiario_nombre?: string | null
          buyer_id?: string
          cancelled_at?: string | null
          clabe_virtual?: string | null
          comision_cents?: number | null
          commission_bps?: number
          commission_payer?: Database["public"]["Enums"]["commission_payer"]
          contrato_pdf_url?: string | null
          counterparty_email?: string | null
          creado_por?: string | null
          created_at?: string
          currency?: string
          delivery_deadline?: string | null
          description?: string | null
          descuento_volumetrico?: number | null
          fecha_activacion?: string | null
          fecha_cancelada?: string | null
          fecha_completada?: string | null
          fecha_firma_beneficiario?: string | null
          fecha_firma_pagador?: string | null
          funded_at?: string | null
          funding_deadline?: string | null
          id?: string
          ip_creacion?: unknown
          iva_comision_cents?: number | null
          numero?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          released_at?: string | null
          repse_requerido?: boolean | null
          sector?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          stripe_payment_intent_id?: string | null
          title?: string
          total_a_depositar_cents?: number | null
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
          captured_at: string | null
          created_at: string
          file_name: string
          file_path: string
          id: string
          latitude: number | null
          longitude: number | null
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
          captured_at?: string | null
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          latitude?: number | null
          longitude?: number | null
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
          captured_at?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
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
      cancel_my_onboarding: { Args: never; Returns: undefined }
      cleanup_abandoned_onboarding: { Args: never; Returns: number }
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["org_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_platform_role: {
        Args: {
          _role: Database["public"]["Enums"]["platform_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_owner: {
        Args: { _org_id: string; _user_id: string }
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
      kyb_status: "not_started" | "in_review" | "approved" | "rejected"
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
      membership_status: "active" | "invited" | "suspended" | "removed"
      org_role:
        | "owner"
        | "buyer_admin"
        | "buyer_user"
        | "seller_admin"
        | "seller_user"
        | "auditor"
      org_type: "individual" | "business"
      payment_method: "spei" | "card"
      platform_role:
        | "compliance"
        | "dispute_manager"
        | "support"
        | "platform_admin"
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
        | "pending_signature"
        | "partial_release"
        | "en_verificacion"
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
      kyb_status: ["not_started", "in_review", "approved", "rejected"],
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
      membership_status: ["active", "invited", "suspended", "removed"],
      org_role: [
        "owner",
        "buyer_admin",
        "buyer_user",
        "seller_admin",
        "seller_user",
        "auditor",
      ],
      org_type: ["individual", "business"],
      payment_method: ["spei", "card"],
      platform_role: [
        "compliance",
        "dispute_manager",
        "support",
        "platform_admin",
      ],
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
        "pending_signature",
        "partial_release",
        "en_verificacion",
      ],
    },
  },
} as const
