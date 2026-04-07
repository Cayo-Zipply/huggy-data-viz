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
      pipeline_cards: {
        Row: {
          anotacoes: string | null
          closer_stage: Database["public"]["Enums"]["closer_stage"] | null
          cnpj: string | null
          contract_url: string | null
          created_at: string
          deal_value: number | null
          email: string | null
          id: string
          last_stage: string | null
          lead_status: string | null
          loss_reason: string | null
          nome: string
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
          deal_value?: number | null
          email?: string | null
          id?: string
          last_stage?: string | null
          lead_status?: string | null
          loss_reason?: string | null
          nome: string
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
          deal_value?: number | null
          email?: string | null
          id?: string
          last_stage?: string | null
          lead_status?: string | null
          loss_reason?: string | null
          nome?: string
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
          role: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          nome: string
          role?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
          role?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: { _user_id: string }; Returns: boolean }
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
