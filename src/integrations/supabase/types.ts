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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      feedbacks: {
        Row: {
          created_at: string
          descricao: string
          id: string
          pagina: string | null
          resposta_admin: string | null
          screenshot_url: string | null
          status: string
          tipo: string
          updated_at: string
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          pagina?: string | null
          resposta_admin?: string | null
          screenshot_url?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          pagina?: string | null
          resposta_admin?: string | null
          screenshot_url?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      lead_anexos: {
        Row: {
          conteudo_texto: string | null
          created_at: string
          id: string
          lead_id: string
          mime_type: string | null
          nome_arquivo: string
          source: string
          storage_path: string | null
          tamanho_bytes: number | null
          tipo: string
          updated_at: string
          uploaded_by: string | null
          uploaded_by_nome: string | null
          url_publica: string | null
        }
        Insert: {
          conteudo_texto?: string | null
          created_at?: string
          id?: string
          lead_id: string
          mime_type?: string | null
          nome_arquivo: string
          source?: string
          storage_path?: string | null
          tamanho_bytes?: number | null
          tipo?: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_nome?: string | null
          url_publica?: string | null
        }
        Update: {
          conteudo_texto?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          mime_type?: string | null
          nome_arquivo?: string
          source?: string
          storage_path?: string | null
          tamanho_bytes?: number | null
          tipo?: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_nome?: string | null
          url_publica?: string | null
        }
        Relationships: []
      }
      lead_anotacoes: {
        Row: {
          autor_nome: string | null
          autor_user_id: string | null
          created_at: string
          id: string
          is_edited: boolean | null
          lead_id: string
          source: string | null
          texto: string
          updated_at: string
        }
        Insert: {
          autor_nome?: string | null
          autor_user_id?: string | null
          created_at?: string
          id?: string
          is_edited?: boolean | null
          lead_id: string
          source?: string | null
          texto: string
          updated_at?: string
        }
        Update: {
          autor_nome?: string | null
          autor_user_id?: string | null
          created_at?: string
          id?: string
          is_edited?: boolean | null
          lead_id?: string
          source?: string | null
          texto?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_history: {
        Row: {
          created_at: string | null
          descricao: string
          id: string
          lead_id: string
          tipo: string
          usuario_nome: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          created_at?: string | null
          descricao: string
          id?: string
          lead_id: string
          tipo: string
          usuario_nome?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string
          id?: string
          lead_id?: string
          tipo?: string
          usuario_nome?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: []
      }
      marketing_overrides: {
        Row: {
          created_at: string
          id: string
          manual_cliques: number | null
          manual_cpc: number | null
          manual_cpm: number | null
          manual_ctr: number | null
          manual_faturamento: number | null
          manual_impressoes: number | null
          manual_investimento: number | null
          manual_mensagens: number | null
          manual_reunioes: number | null
          manual_vendas: number | null
          month: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          manual_cliques?: number | null
          manual_cpc?: number | null
          manual_cpm?: number | null
          manual_ctr?: number | null
          manual_faturamento?: number | null
          manual_impressoes?: number | null
          manual_investimento?: number | null
          manual_mensagens?: number | null
          manual_reunioes?: number | null
          manual_vendas?: number | null
          month: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          manual_cliques?: number | null
          manual_cpc?: number | null
          manual_cpm?: number | null
          manual_ctr?: number | null
          manual_faturamento?: number | null
          manual_impressoes?: number | null
          manual_investimento?: number | null
          manual_mensagens?: number | null
          manual_reunioes?: number | null
          manual_vendas?: number | null
          month?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      motivos_perda: {
        Row: {
          ativo: boolean | null
          categoria: string
          created_at: string | null
          id: string
          nome: string
          ordem: number | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string
          created_at?: string | null
          id?: string
          nome: string
          ordem?: number | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string
          created_at?: string | null
          id?: string
          nome?: string
          ordem?: number | null
        }
        Relationships: []
      }
      pipeline_card_labels: {
        Row: {
          card_id: string
          created_at: string
          id: string
          label_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          label_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          label_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_card_labels_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "pipeline_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_card_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "pipeline_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_cards: {
        Row: {
          anotacoes: string | null
          closer_stage: Database["public"]["Enums"]["closer_stage"] | null
          cnpj: string | null
          contract_url: string | null
          created_at: string
          data_perda: string | null
          deal_value: number | null
          email: string | null
          fim_de_semana: boolean
          id: string
          last_stage: string | null
          lead_status: string | null
          loss_reason: string | null
          motivo_perda_id: string | null
          nome: string
          observacao_perda: string | null
          origem: string | null
          owner: string | null
          pipe: Database["public"]["Enums"]["pipe_type"]
          sdr_stage: Database["public"]["Enums"]["sdr_stage"] | null
          sheet_row_id: string | null
          stage_changed_at: string | null
          telefone: string | null
          updated_at: string
          valor_divida: number | null
        }
        Insert: {
          anotacoes?: string | null
          closer_stage?: Database["public"]["Enums"]["closer_stage"] | null
          cnpj?: string | null
          contract_url?: string | null
          created_at?: string
          data_perda?: string | null
          deal_value?: number | null
          email?: string | null
          fim_de_semana?: boolean
          id?: string
          last_stage?: string | null
          lead_status?: string | null
          loss_reason?: string | null
          motivo_perda_id?: string | null
          nome: string
          observacao_perda?: string | null
          origem?: string | null
          owner?: string | null
          pipe?: Database["public"]["Enums"]["pipe_type"]
          sdr_stage?: Database["public"]["Enums"]["sdr_stage"] | null
          sheet_row_id?: string | null
          stage_changed_at?: string | null
          telefone?: string | null
          updated_at?: string
          valor_divida?: number | null
        }
        Update: {
          anotacoes?: string | null
          closer_stage?: Database["public"]["Enums"]["closer_stage"] | null
          cnpj?: string | null
          contract_url?: string | null
          created_at?: string
          data_perda?: string | null
          deal_value?: number | null
          email?: string | null
          fim_de_semana?: boolean
          id?: string
          last_stage?: string | null
          lead_status?: string | null
          loss_reason?: string | null
          motivo_perda_id?: string | null
          nome?: string
          observacao_perda?: string | null
          origem?: string | null
          owner?: string | null
          pipe?: Database["public"]["Enums"]["pipe_type"]
          sdr_stage?: Database["public"]["Enums"]["sdr_stage"] | null
          sheet_row_id?: string | null
          stage_changed_at?: string | null
          telefone?: string | null
          updated_at?: string
          valor_divida?: number | null
        }
        Relationships: []
      }
      pipeline_goals: {
        Row: {
          closer: string
          conversao_meta: number | null
          created_at: string | null
          faturamento_meta: number | null
          id: string
          month: string
          reunioes_marcadas_meta: number | null
          reunioes_realizadas_meta: number | null
          updated_at: string | null
        }
        Insert: {
          closer: string
          conversao_meta?: number | null
          created_at?: string | null
          faturamento_meta?: number | null
          id?: string
          month: string
          reunioes_marcadas_meta?: number | null
          reunioes_realizadas_meta?: number | null
          updated_at?: string | null
        }
        Update: {
          closer?: string
          conversao_meta?: number | null
          created_at?: string | null
          faturamento_meta?: number | null
          id?: string
          month?: string
          reunioes_marcadas_meta?: number | null
          reunioes_realizadas_meta?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pipeline_labels: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      pipeline_sla_rules: {
        Row: {
          acao_ao_estourar: string | null
          alerta_para: string[] | null
          created_at: string | null
          etapa: string
          id: string
          sla_horas: number
          updated_at: string | null
        }
        Insert: {
          acao_ao_estourar?: string | null
          alerta_para?: string[] | null
          created_at?: string | null
          etapa: string
          id?: string
          sla_horas?: number
          updated_at?: string | null
        }
        Update: {
          acao_ao_estourar?: string | null
          alerta_para?: string[] | null
          created_at?: string | null
          etapa?: string
          id?: string
          sla_horas?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      pipeline_tasks: {
        Row: {
          auto_generated: boolean | null
          card_id: string
          created_at: string | null
          due_date: string
          id: string
          pipe_context: string | null
          responsible: string | null
          status: string | null
          title: string
        }
        Insert: {
          auto_generated?: boolean | null
          card_id: string
          created_at?: string | null
          due_date?: string
          id?: string
          pipe_context?: string | null
          responsible?: string | null
          status?: string | null
          title: string
        }
        Update: {
          auto_generated?: boolean | null
          card_id?: string
          created_at?: string | null
          due_date?: string
          id?: string
          pipe_context?: string | null
          responsible?: string | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_tasks_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "pipeline_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string
          pode_ser_responsavel: boolean
          role: string | null
          secondary_role: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          nome: string
          pode_ser_responsavel?: boolean
          role?: string | null
          secondary_role?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
          pode_ser_responsavel?: boolean
          role?: string | null
          secondary_role?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      vw_conversao_fim_de_semana: {
        Row: {
          em_aberto: number | null
          ganhos: number | null
          perdidos: number | null
          periodo: string | null
          receita_total: number | null
          taxa_conversao_pct: number | null
          ticket_medio_ganho: number | null
          total_leads: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_weekend_sp: { Args: { ts: string }; Returns: boolean }
    }
    Enums: {
      closer_stage:
        | "reuniao_agendada"
        | "no_show"
        | "reuniao_realizada"
        | "link_enviado"
        | "contrato_assinado"
      pipe_type: "sdr" | "closer"
      sdr_stage: "lead" | "conectado" | "sql" | "reuniao_marcada"
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
      closer_stage: [
        "reuniao_agendada",
        "no_show",
        "reuniao_realizada",
        "link_enviado",
        "contrato_assinado",
      ],
      pipe_type: ["sdr", "closer"],
      sdr_stage: ["lead", "conectado", "sql", "reuniao_marcada"],
    },
  },
} as const
