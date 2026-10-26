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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      aplicacoes: {
        Row: {
          atividade_id: number
          codigo: string
          created_at: string
          data: string | null
          id: number
          status: string
          turma_id: number | null
          updated_at: string
        }
        Insert: {
          atividade_id: number
          codigo: string
          created_at?: string
          data?: string | null
          id?: number
          status?: string
          turma_id?: number | null
          updated_at?: string
        }
        Update: {
          atividade_id?: number
          codigo?: string
          created_at?: string
          data?: string | null
          id?: number
          status?: string
          turma_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aplicacoes_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aplicacoes_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      atividade_senhas: {
        Row: {
          atividade_id: number
          created_at: string
          senha_hash: string
          senha_texto: string | null
          updated_at: string
        }
        Insert: {
          atividade_id: number
          created_at?: string
          senha_hash: string
          senha_texto?: string | null
          updated_at?: string
        }
        Update: {
          atividade_id?: number
          created_at?: string
          senha_hash?: string
          senha_texto?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividade_senhas_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: true
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
        ]
      }
      atividades: {
        Row: {
          created_at: string
          deleted_at: string | null
          embaralhar_links: boolean
          id: number
          pasta_id: number | null
          professor_id: number
          publicada_em: string | null
          status: string
          subtitulo: string | null
          titulo: string
          trash_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          embaralhar_links?: boolean
          id?: number
          pasta_id?: number | null
          professor_id: number
          publicada_em?: string | null
          status?: string
          subtitulo?: string | null
          titulo: string
          trash_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          embaralhar_links?: boolean
          id?: number
          pasta_id?: number | null
          professor_id?: number
          publicada_em?: string | null
          status?: string
          subtitulo?: string | null
          titulo?: string
          trash_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividades_pasta_id_fkey"
            columns: ["pasta_id"]
            isOneToOne: false
            referencedRelation: "pastas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professores"
            referencedColumns: ["id"]
          },
        ]
      }
      participacoes: {
        Row: {
          aplicacao_id: number
          concluido_em: string | null
          estudante_id: number
          expulso_em: string | null
          id: number
          iniciado_em: string
          nome: string
        }
        Insert: {
          aplicacao_id: number
          concluido_em?: string | null
          estudante_id: number
          expulso_em?: string | null
          id?: number
          iniciado_em?: string
          nome: string
        }
        Update: {
          aplicacao_id?: number
          concluido_em?: string | null
          estudante_id?: number
          expulso_em?: string | null
          id?: number
          iniciado_em?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "participacoes_aplicacao_id_fkey"
            columns: ["aplicacao_id"]
            isOneToOne: false
            referencedRelation: "aplicacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participacoes_estudante_id_fkey"
            columns: ["estudante_id"]
            isOneToOne: false
            referencedRelation: "estudantes"
            referencedColumns: ["id"]
          },
        ]
      }
      estudantes: {
        Row: {
          created_at: string
          id: number
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      links: {
        Row: {
          atividade_id: number
          created_at: string
          descricao: string | null
          href: string
          id: number
          ordem: number
          titulo: string
        }
        Insert: {
          atividade_id: number
          created_at?: string
          descricao?: string | null
          href: string
          id?: number
          ordem: number
          titulo: string
        }
        Update: {
          atividade_id?: number
          created_at?: string
          descricao?: string | null
          href?: string
          id?: number
          ordem?: number
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "links_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
        ]
      }
      pastas: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: number
          nome: string
          parent_id: number | null
          professor_id: number
          trash_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: number
          nome: string
          parent_id?: number | null
          professor_id: number
          trash_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: number
          nome?: string
          parent_id?: number | null
          professor_id?: number
          trash_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pastas_parent_same_professor_fk"
            columns: ["parent_id", "professor_id"]
            isOneToOne: false
            referencedRelation: "pastas"
            referencedColumns: ["id", "professor_id"]
          },
          {
            foreignKeyName: "pastas_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professores"
            referencedColumns: ["id"]
          },
        ]
      }
      professores: {
        Row: {
          created_at: string
          id: number
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      progresso_estudante: {
        Row: {
          created_at: string
          link_id: number
          ordem_embaralhada: number | null
          participacao_id: number
          pontuacao: number | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          link_id: number
          ordem_embaralhada?: number | null
          participacao_id: number
          pontuacao?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          link_id?: number
          ordem_embaralhada?: number | null
          participacao_id?: number
          pontuacao?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "progresso_estudante_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progresso_estudante_participacao_id_fkey"
            columns: ["participacao_id"]
            isOneToOne: false
            referencedRelation: "participacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      turmas: {
        Row: {
          created_at: string
          id: number
          nome: string
          professor_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          nome: string
          professor_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          nome?: string
          professor_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "turmas_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_link: {
        Args: {
          p_aplicacao_id: number
          p_link_id: number
          p_pontuacao: number | null
          p_senha: string
        }
        Returns: Json
      }
      duplicate_atividade: {
        Args: { p_atividade_id: number }
        Returns: number
      }
      duplicate_pasta: {
        Args: { p_pasta_id: number }
        Returns: number
      }
      empty_trash: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      expel_student: {
        Args: { p_participacao_id: number }
        Returns: undefined
      }
      join_activity: {
        Args: { p_codigo: string; p_nome: string }
        Returns: Json
      }
      move_link: {
        Args: { p_direcao: number; p_link_id: number }
        Returns: undefined
      }
      purge_trash: {
        Args: { p_trash_id: string }
        Returns: undefined
      }
      reorder_links: {
        Args: { p_atividade_id: number; p_link_ids: number[] }
        Returns: undefined
      }
      restore_trash: {
        Args: { p_trash_id: string }
        Returns: undefined
      }
      session_started_at: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      set_activity_password: {
        Args: { p_atividade_id: number; p_senha: string }
        Returns: undefined
      }
      set_atividade_ativa: {
        Args: { p_atividade_id: number; p_ativa: boolean }
        Returns: undefined
      }
      set_student_progress: {
        Args: {
          p_link_id: number
          p_participacao_id: number
          p_pontuacao: number | null
          p_status: string
        }
        Returns: undefined
      }
      trash_atividade: {
        Args: { p_atividade_id: number }
        Returns: string
      }
      trash_items: {
        Args: { p_atividades?: number[]; p_pastas?: number[] }
        Returns: string
      }
      trash_pasta: {
        Args: { p_pasta_id: number }
        Returns: string
      }
      update_my_progress: {
        Args: { p_aplicacao_id: number; p_link_id: number; p_status: string }
        Returns: undefined
      }
      validate_join_code: { Args: { p_codigo: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
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
    Enums: {},
  },
} as const
