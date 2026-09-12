export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      botao_panico: {
        Row: {
          cliques: number;
          created_at: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          cliques?: number;
          created_at?: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          cliques?: number;
          created_at?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fotos: {
        Row: {
          autor: string;
          created_at: string;
          id: string;
          legenda: string | null;
          path: string;
        };
        Insert: {
          autor: string;
          created_at?: string;
          id?: string;
          legenda?: string | null;
          path: string;
        };
        Update: {
          autor?: string;
          created_at?: string;
          id?: string;
          legenda?: string | null;
          path?: string;
        };
        Relationships: [];
      };
      mural: {
        Row: {
          autor: string;
          created_at: string;
          destinatario: string;
          id: string;
          mensagem: string;
        };
        Insert: {
          autor: string;
          created_at?: string;
          destinatario: string;
          id?: string;
          mensagem: string;
        };
        Update: {
          autor?: string;
          created_at?: string;
          destinatario?: string;
          id?: string;
          mensagem?: string;
        };
        Relationships: [];
      };
      pacientes: {
        Row: {
          amnesia_anterograda: number;
          aptidao_audio: number;
          avatar: Json;
          created_at: string;
          fator_coringa: number;
          id: string;
          imunidade_etilica: number;
          inimigo_do_fim: number;
          itens: Json;
          nome: string;
          personagem: string;
          token: string;
        };
        Insert: {
          amnesia_anterograda?: number;
          aptidao_audio?: number;
          avatar?: Json;
          created_at?: string;
          fator_coringa?: number;
          id?: string;
          imunidade_etilica?: number;
          inimigo_do_fim?: number;
          itens?: Json;
          nome: string;
          personagem?: string;
          token?: string;
        };
        Update: {
          amnesia_anterograda?: number;
          aptidao_audio?: number;
          avatar?: Json;
          created_at?: string;
          fator_coringa?: number;
          id?: string;
          imunidade_etilica?: number;
          inimigo_do_fim?: number;
          itens?: Json;
          nome?: string;
          personagem?: string;
          token?: string;
        };
        Relationships: [];
      };
      transacoes: {
        Row: {
          chave_idempotencia: string | null;
          created_at: string;
          de_paciente: string | null;
          id: string;
          motivo: string;
          para_paciente: string;
          pontos: number;
          referencia: string | null;
        };
        Insert: {
          chave_idempotencia?: string | null;
          created_at?: string;
          de_paciente?: string | null;
          id?: string;
          motivo: string;
          para_paciente: string;
          pontos: number;
          referencia?: string | null;
        };
        Update: {
          created_at?: string;
          de_paciente?: string | null;
          id?: string;
          motivo?: string;
          para_paciente?: string;
          pontos?: number;
          referencia?: string | null;
        };
        Relationships: [];
      };
      gastos: {
        Row: {
          created_at: string;
          id: string;
          item: string;
          paciente_id: string;
          pontos: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          item: string;
          paciente_id: string;
          pontos: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          item?: string;
          paciente_id?: string;
          pontos?: number;
        };
        Relationships: [];
      };
      curtidas: {
        Row: {
          created_at: string;
          de_paciente: string;
          id: string;
          para_paciente: string;
        };
        Insert: {
          created_at?: string;
          de_paciente: string;
          id?: string;
          para_paciente: string;
        };
        Update: {
          created_at?: string;
          de_paciente?: string;
          id?: string;
          para_paciente?: string;
        };
        Relationships: [];
      };
      desafios: {
        Row: {
          created_at: string;
          de_paciente: string;
          escolha_de: number | null;
          escolha_para: number | null;
          id: string;
          para_paciente: string;
          pontos: number;
          resolvido_em: string | null;
          status: string;
          vencedor: string | null;
        };
        Insert: {
          created_at?: string;
          de_paciente: string;
          escolha_de?: number | null;
          escolha_para?: number | null;
          id?: string;
          para_paciente: string;
          pontos: number;
          resolvido_em?: string | null;
          status?: string;
          vencedor?: string | null;
        };
        Update: {
          created_at?: string;
          de_paciente?: string;
          escolha_de?: number | null;
          escolha_para?: number | null;
          id?: string;
          para_paciente?: string;
          pontos?: number;
          resolvido_em?: string | null;
          status?: string;
          vencedor?: string | null;
        };
        Relationships: [];
      };
      prendas: {
        Row: {
          created_at: string;
          de_paciente: string;
          id: string;
          para_paciente: string;
          respondida_em: string | null;
          segundos: number;
          status: string;
        };
        Insert: {
          created_at?: string;
          de_paciente: string;
          id?: string;
          para_paciente: string;
          respondida_em?: string | null;
          segundos: number;
          status?: string;
        };
        Update: {
          created_at?: string;
          de_paciente?: string;
          id?: string;
          para_paciente?: string;
          respondida_em?: string | null;
          segundos?: number;
          status?: string;
        };
        Relationships: [];
      };
      premiacao: {
        Row: {
          apurado_em: string;
          ganhos_total: number;
          id: string;
          nome: string;
          paciente_id: string;
          posicao: number;
        };
        Insert: {
          apurado_em?: string;
          ganhos_total: number;
          id?: string;
          nome: string;
          paciente_id: string;
          posicao: number;
        };
        Update: {
          apurado_em?: string;
          ganhos_total?: number;
          id?: string;
          nome?: string;
          paciente_id?: string;
          posicao?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      pacientes_publicos: {
        Row: {
          amnesia_anterograda: number | null;
          aptidao_audio: number | null;
          avatar: Json | null;
          created_at: string | null;
          fator_coringa: number | null;
          id: string | null;
          imunidade_etilica: number | null;
          inimigo_do_fim: number | null;
          itens: Json | null;
          nome: string | null;
          personagem: string | null;
        };
        Relationships: [];
      };
      saldo_pacientes: {
        Row: {
          avatar: Json | null;
          created_at: string | null;
          ganhos_total: number | null;
          itens: Json | null;
          nome: string | null;
          paciente_id: string | null;
          personagem: string | null;
          saldo: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      incrementar_panico: { Args: { _qtd?: number }; Returns: number };
      internar_paciente: {
        Args: {
          _amnesia_anterograda: number;
          _aptidao_audio: number;
          _avatar: Json;
          _fator_coringa: number;
          _imunidade_etilica: number;
          _inimigo_do_fim: number;
          _nome: string;
          _personagem: string;
        };
        Returns: { id: string; token: string }[];
      };
      creditar_pontos: {
        Args: {
          _chave?: string | null;
          _motivo: string;
          _paciente: string;
          _pontos: number;
          _referencia?: string | null;
          _token: string;
        };
        Returns: number;
      };
      postar_recado: {
        Args: { _autor: string; _chave?: string | null; _destinatario: string; _mensagem: string };
        Returns: boolean;
      };
      registrar_foto: {
        Args: { _autor: string; _chave?: string | null; _legenda?: string | null; _path: string };
        Returns: boolean;
      };
      transferir_pontos: {
        Args: {
          _de: string;
          _motivo?: string;
          _para: string;
          _pontos: number;
          _token: string;
        };
        Returns: number;
      };
      gastar_pontos: {
        Args: { _item: string; _paciente: string; _pontos: number; _token: string };
        Returns: number;
      };
      equipar_item: {
        Args: { _item: string | null; _paciente: string; _slot: string; _token: string };
        Returns: Json;
      };
      curtir: { Args: { _de: string; _para: string; _token: string }; Returns: boolean };
      mandar_prenda: {
        Args: { _de: string; _para: string; _token: string };
        Returns: { id: string; segundos: number }[];
      };
      responder_prenda: {
        Args: { _cumpriu: boolean; _paciente: string; _prenda: string; _token: string };
        Returns: number;
      };
      criar_desafio: {
        Args: { _de: string; _para: string; _pontos: number; _token: string };
        Returns: string;
      };
      responder_desafio: {
        Args: { _aceita: boolean; _desafio: string; _paciente: string; _token: string };
        Returns: string;
      };
      jogar_desafio: {
        Args: { _desafio: string; _escolha: number; _paciente: string; _token: string };
        Returns: string;
      };
      apurar_premiacao: {
        Args: { _momento: string };
        Returns: {
          apurado_em: string;
          ganhos_total: number;
          id: string;
          nome: string;
          paciente_id: string;
          posicao: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
