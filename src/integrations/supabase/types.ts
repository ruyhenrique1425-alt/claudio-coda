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
      allstar_pontos_declaracao: {
        Row: {
          brand: Database["public"]["Enums"]["chopp_brand"]
          cheios_nos_pontos: number
          created_at: string
          data: string
          id: string
          notes: string | null
          performed_by: string | null
          vazios_nos_pontos: number
        }
        Insert: {
          brand: Database["public"]["Enums"]["chopp_brand"]
          cheios_nos_pontos?: number
          created_at?: string
          data?: string
          id?: string
          notes?: string | null
          performed_by?: string | null
          vazios_nos_pontos?: number
        }
        Update: {
          brand?: Database["public"]["Enums"]["chopp_brand"]
          cheios_nos_pontos?: number
          created_at?: string
          data?: string
          id?: string
          notes?: string | null
          performed_by?: string | null
          vazios_nos_pontos?: number
        }
        Relationships: []
      }
      backup_runs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          rows_total: number | null
          run_date: string
          signed_url: string | null
          size_bytes: number | null
          status: string
          storage_path: string | null
          tables_count: number | null
          triggered_by: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          rows_total?: number | null
          run_date?: string
          signed_url?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string | null
          tables_count?: number | null
          triggered_by?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          rows_total?: number | null
          run_date?: string
          signed_url?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string | null
          tables_count?: number | null
          triggered_by?: string
          updated_at?: string
        }
        Relationships: []
      }
      bar_card_machine_sessions: {
        Row: {
          bar_id: string
          created_at: string
          event_date: string
          id: string
          notes: string | null
          patrimonio: string
          picked_up_at: string
          picked_up_by: string | null
          picked_up_photo: string | null
          returned_at: string | null
          returned_by: string | null
          returned_photo: string | null
          updated_at: string
        }
        Insert: {
          bar_id: string
          created_at?: string
          event_date?: string
          id?: string
          notes?: string | null
          patrimonio: string
          picked_up_at?: string
          picked_up_by?: string | null
          picked_up_photo?: string | null
          returned_at?: string | null
          returned_by?: string | null
          returned_photo?: string | null
          updated_at?: string
        }
        Update: {
          bar_id?: string
          created_at?: string
          event_date?: string
          id?: string
          notes?: string | null
          patrimonio?: string
          picked_up_at?: string
          picked_up_by?: string | null
          picked_up_photo?: string | null
          returned_at?: string | null
          returned_by?: string | null
          returned_photo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bar_card_machine_sessions_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_card_readers: {
        Row: {
          bar_id: string
          id: string
          quantidade: number
        }
        Insert: {
          bar_id: string
          id?: string
          quantidade?: number
        }
        Update: {
          bar_id?: string
          id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "bar_card_readers_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: true
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_installations: {
        Row: {
          bar_id: string
          bicos: number | null
          brand: Database["public"]["Enums"]["chopp_brand"] | null
          cilindro_qtd: number
          contrato_photo_url: string | null
          created_at: string
          id: string
          informacoes: string | null
          manometro_qtd: number
          responsavel_nome: string | null
          responsavel_telefone: string | null
          updated_at: string
          updated_by: string | null
          valores: string | null
        }
        Insert: {
          bar_id: string
          bicos?: number | null
          brand?: Database["public"]["Enums"]["chopp_brand"] | null
          cilindro_qtd?: number
          contrato_photo_url?: string | null
          created_at?: string
          id?: string
          informacoes?: string | null
          manometro_qtd?: number
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          updated_at?: string
          updated_by?: string | null
          valores?: string | null
        }
        Update: {
          bar_id?: string
          bicos?: number | null
          brand?: Database["public"]["Enums"]["chopp_brand"] | null
          cilindro_qtd?: number
          contrato_photo_url?: string | null
          created_at?: string
          id?: string
          informacoes?: string | null
          manometro_qtd?: number
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          updated_at?: string
          updated_by?: string | null
          valores?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bar_installations_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: true
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_machine_patrimonios: {
        Row: {
          ativo: boolean
          bar_id: string
          created_at: string
          id: string
          patrimonio: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bar_id: string
          created_at?: string
          id?: string
          patrimonio: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bar_id?: string
          created_at?: string
          id?: string
          patrimonio?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bar_machine_patrimonios_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_machines: {
        Row: {
          bar_id: string
          bicos: number
          brand: Database["public"]["Enums"]["chopp_brand"]
          created_at: string
          id: string
          quantidade: number
        }
        Insert: {
          bar_id: string
          bicos: number
          brand: Database["public"]["Enums"]["chopp_brand"]
          created_at?: string
          id?: string
          quantidade?: number
        }
        Update: {
          bar_id?: string
          bicos?: number
          brand?: Database["public"]["Enums"]["chopp_brand"]
          created_at?: string
          id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "bar_machines_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_maintenance_logs: {
        Row: {
          bar_id: string
          created_at: string
          description: string
          id: string
          performed_at: string
          performed_by: string
          photo_url: string | null
        }
        Insert: {
          bar_id: string
          created_at?: string
          description: string
          id?: string
          performed_at?: string
          performed_by: string
          photo_url?: string | null
        }
        Update: {
          bar_id?: string
          created_at?: string
          description?: string
          id?: string
          performed_at?: string
          performed_by?: string
          photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bar_maintenance_logs_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_organization_checks: {
        Row: {
          bar_id: string
          client_op_id: string | null
          copo_ok: boolean
          created_at: string
          id: string
          limpo_ok: boolean
          meninas_ok: boolean
          notes: string | null
          performed_at: string
          performed_by: string
          sem_fila_ok: boolean
        }
        Insert: {
          bar_id: string
          client_op_id?: string | null
          copo_ok?: boolean
          created_at?: string
          id?: string
          limpo_ok?: boolean
          meninas_ok?: boolean
          notes?: string | null
          performed_at?: string
          performed_by: string
          sem_fila_ok?: boolean
        }
        Update: {
          bar_id?: string
          client_op_id?: string | null
          copo_ok?: boolean
          created_at?: string
          id?: string
          limpo_ok?: boolean
          meninas_ok?: boolean
          notes?: string | null
          performed_at?: string
          performed_by?: string
          sem_fila_ok?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "bar_organization_checks_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_shifts: {
        Row: {
          bar_id: string
          id: string
          meninas_qtd: number
          shift: Database["public"]["Enums"]["shift_slot"]
        }
        Insert: {
          bar_id: string
          id?: string
          meninas_qtd?: number
          shift: Database["public"]["Enums"]["shift_slot"]
        }
        Update: {
          bar_id?: string
          id?: string
          meninas_qtd?: number
          shift?: Database["public"]["Enums"]["shift_slot"]
        }
        Relationships: [
          {
            foreignKeyName: "bar_shifts_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_staff_checks: {
        Row: {
          bar_id: string
          card_readers_count: number
          cards_ok: boolean
          checkpoint: number
          created_at: string
          id: string
          meninas_count: number
          meninas_ok: boolean
          notes: string | null
          performed_at: string
          performed_by: string | null
          photo_url: string | null
        }
        Insert: {
          bar_id: string
          card_readers_count?: number
          cards_ok?: boolean
          checkpoint: number
          created_at?: string
          id?: string
          meninas_count?: number
          meninas_ok?: boolean
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          photo_url?: string | null
        }
        Update: {
          bar_id?: string
          card_readers_count?: number
          cards_ok?: boolean
          checkpoint?: number
          created_at?: string
          id?: string
          meninas_count?: number
          meninas_ok?: boolean
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bar_staff_checks_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_stock_standard: {
        Row: {
          bar_id: string
          barris_padrao: number
          brand: Database["public"]["Enums"]["chopp_brand"]
          id: string
        }
        Insert: {
          bar_id: string
          barris_padrao?: number
          brand: Database["public"]["Enums"]["chopp_brand"]
          id?: string
        }
        Update: {
          bar_id?: string
          barris_padrao?: number
          brand?: Database["public"]["Enums"]["chopp_brand"]
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bar_stock_standard_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_temperature_checks: {
        Row: {
          bar_id: string
          client_op_id: string | null
          created_at: string
          id: string
          notes: string | null
          performed_at: string
          performed_by: string
          photo_url: string
          slot: Database["public"]["Enums"]["temp_slot"]
          temperatura: number
        }
        Insert: {
          bar_id: string
          client_op_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          performed_at?: string
          performed_by: string
          photo_url: string
          slot: Database["public"]["Enums"]["temp_slot"]
          temperatura: number
        }
        Update: {
          bar_id?: string
          client_op_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          performed_at?: string
          performed_by?: string
          photo_url?: string
          slot?: Database["public"]["Enums"]["temp_slot"]
          temperatura?: number
        }
        Relationships: [
          {
            foreignKeyName: "bar_temperature_checks_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_transfer_items: {
        Row: {
          brand: string
          id: string
          quantidade: number
          transfer_id: string
        }
        Insert: {
          brand: string
          id?: string
          quantidade: number
          transfer_id: string
        }
        Update: {
          brand?: string
          id?: string
          quantidade?: number
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bar_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "bar_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_transfers: {
        Row: {
          created_at: string
          from_bar_id: string
          id: string
          notes: string | null
          performed_at: string
          performed_by: string | null
          photo_url: string | null
          to_bar_id: string
        }
        Insert: {
          created_at?: string
          from_bar_id: string
          id?: string
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          photo_url?: string | null
          to_bar_id: string
        }
        Update: {
          created_at?: string
          from_bar_id?: string
          id?: string
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          photo_url?: string | null
          to_bar_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bar_transfers_from_bar_id_fkey"
            columns: ["from_bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bar_transfers_to_bar_id_fkey"
            columns: ["to_bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      bars: {
        Row: {
          apoio_responsavel: string | null
          bar_type: Database["public"]["Enums"]["bar_type"]
          cartao_meep: string | null
          cilindros_qtd: number
          created_at: string
          created_by: string | null
          id: string
          latitude: number
          longitude: number
          manometros_qtd: number
          name: string
          notes: string | null
          pre_resfriadores_qtd: number
          rota_id: string | null
          updated_at: string
        }
        Insert: {
          apoio_responsavel?: string | null
          bar_type: Database["public"]["Enums"]["bar_type"]
          cartao_meep?: string | null
          cilindros_qtd?: number
          created_at?: string
          created_by?: string | null
          id?: string
          latitude: number
          longitude: number
          manometros_qtd?: number
          name: string
          notes?: string | null
          pre_resfriadores_qtd?: number
          rota_id?: string | null
          updated_at?: string
        }
        Update: {
          apoio_responsavel?: string | null
          bar_type?: Database["public"]["Enums"]["bar_type"]
          cartao_meep?: string | null
          cilindros_qtd?: number
          created_at?: string
          created_by?: string | null
          id?: string
          latitude?: number
          longitude?: number
          manometros_qtd?: number
          name?: string
          notes?: string | null
          pre_resfriadores_qtd?: number
          rota_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bars_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
            referencedColumns: ["id"]
          },
        ]
      }
      controle_comodato_global: {
        Row: {
          cheios_recebidos_acumulados: number
          id: string
          marca: string
          updated_at: string
          vazios_devolvidos_acumulados: number
          vazios_disponiveis: number
        }
        Insert: {
          cheios_recebidos_acumulados?: number
          id?: string
          marca: string
          updated_at?: string
          vazios_devolvidos_acumulados?: number
          vazios_disponiveis?: number
        }
        Update: {
          cheios_recebidos_acumulados?: number
          id?: string
          marca?: string
          updated_at?: string
          vazios_devolvidos_acumulados?: number
          vazios_disponiveis?: number
        }
        Relationships: []
      }
      empties_removed: {
        Row: {
          bar_id: string
          brand: Database["public"]["Enums"]["chopp_brand"]
          client_op_id: string | null
          created_at: string
          id: string
          notes: string | null
          performed_at: string
          performed_by: string
          photo_url: string | null
          quantidade: number
          refill_id: string | null
        }
        Insert: {
          bar_id: string
          brand: Database["public"]["Enums"]["chopp_brand"]
          client_op_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          performed_at?: string
          performed_by: string
          photo_url?: string | null
          quantidade?: number
          refill_id?: string | null
        }
        Update: {
          bar_id?: string
          brand?: Database["public"]["Enums"]["chopp_brand"]
          client_op_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          performed_at?: string
          performed_by?: string
          photo_url?: string | null
          quantidade?: number
          refill_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empties_removed_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empties_removed_refill_id_fkey"
            columns: ["refill_id"]
            isOneToOne: false
            referencedRelation: "refills"
            referencedColumns: ["id"]
          },
        ]
      }
      empty_movements: {
        Row: {
          bar_id: string | null
          brand: Database["public"]["Enums"]["chopp_brand"]
          carga_id: string | null
          direction: number
          empties_id: string | null
          id: string
          nf_id: string | null
          notes: string | null
          origem: Database["public"]["Enums"]["empty_move_origin"]
          performed_at: string
          performed_by: string | null
          quantidade: number
          warehouse_id: string
        }
        Insert: {
          bar_id?: string | null
          brand: Database["public"]["Enums"]["chopp_brand"]
          carga_id?: string | null
          direction: number
          empties_id?: string | null
          id?: string
          nf_id?: string | null
          notes?: string | null
          origem: Database["public"]["Enums"]["empty_move_origin"]
          performed_at?: string
          performed_by?: string | null
          quantidade: number
          warehouse_id: string
        }
        Update: {
          bar_id?: string | null
          brand?: Database["public"]["Enums"]["chopp_brand"]
          carga_id?: string | null
          direction?: number
          empties_id?: string | null
          id?: string
          nf_id?: string | null
          notes?: string | null
          origem?: Database["public"]["Enums"]["empty_move_origin"]
          performed_at?: string
          performed_by?: string | null
          quantidade?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empty_movements_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empty_movements_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "heineken_cargas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empty_movements_empties_id_fkey"
            columns: ["empties_id"]
            isOneToOne: false
            referencedRelation: "empties_removed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empty_movements_nf_id_fkey"
            columns: ["nf_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empty_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      heineken_cargas: {
        Row: {
          amstel_barris: number
          barris_comodato: number
          client_op_id: string | null
          created_at: string
          heineken_barris: number
          id: string
          invoice_number: string | null
          invoice_photo_url: string | null
          notes: string | null
          performed_by: string | null
          received_at: string
          updated_at: string
          vasilhames_recolhidos: number
        }
        Insert: {
          amstel_barris?: number
          barris_comodato?: number
          client_op_id?: string | null
          created_at?: string
          heineken_barris?: number
          id?: string
          invoice_number?: string | null
          invoice_photo_url?: string | null
          notes?: string | null
          performed_by?: string | null
          received_at?: string
          updated_at?: string
          vasilhames_recolhidos?: number
        }
        Update: {
          amstel_barris?: number
          barris_comodato?: number
          client_op_id?: string | null
          created_at?: string
          heineken_barris?: number
          id?: string
          invoice_number?: string | null
          invoice_photo_url?: string | null
          notes?: string | null
          performed_by?: string | null
          received_at?: string
          updated_at?: string
          vasilhames_recolhidos?: number
        }
        Relationships: []
      }
      inventories: {
        Row: {
          bar_id: string
          client_op_id: string | null
          created_at: string
          id: string
          notes: string | null
          performed_at: string
          performed_by: string
          photo_url: string
        }
        Insert: {
          bar_id: string
          client_op_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          performed_at?: string
          performed_by: string
          photo_url: string
        }
        Update: {
          bar_id?: string
          client_op_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          performed_at?: string
          performed_by?: string
          photo_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventories_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          brand: Database["public"]["Enums"]["chopp_brand"]
          id: string
          inventory_id: string
          quantidade: number
          status: Database["public"]["Enums"]["barrel_status"]
        }
        Insert: {
          brand: Database["public"]["Enums"]["chopp_brand"]
          id?: string
          inventory_id: string
          quantidade?: number
          status: Database["public"]["Enums"]["barrel_status"]
        }
        Update: {
          brand?: Database["public"]["Enums"]["chopp_brand"]
          id?: string
          inventory_id?: string
          quantidade?: number
          status?: Database["public"]["Enums"]["barrel_status"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventories"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_auditoria: {
        Row: {
          acao: string
          created_at: string
          detalhe_json: Json | null
          id: string
          registro_id: string | null
          tabela_afetada: string
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhe_json?: Json | null
          id?: string
          registro_id?: string | null
          tabela_afetada: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhe_json?: Json | null
          id?: string
          registro_id?: string | null
          tabela_afetada?: string
          user_id?: string | null
        }
        Relationships: []
      }
      meep_consumo_bar: {
        Row: {
          bar_id: string | null
          bar_nome: string
          barris: number
          created_at: string
          data: string
          id: string
          marca: string
        }
        Insert: {
          bar_id?: string | null
          bar_nome: string
          barris?: number
          created_at?: string
          data: string
          id?: string
          marca: string
        }
        Update: {
          bar_id?: string | null
          bar_nome?: string
          barris?: number
          created_at?: string
          data?: string
          id?: string
          marca?: string
        }
        Relationships: [
          {
            foreignKeyName: "meep_consumo_bar_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      meep_vendas_bar: {
        Row: {
          bar_id: string | null
          cartao: string | null
          categoria: string | null
          created_at: string
          data: string
          id: string
          is_chopp: boolean
          produto: string
          quantidade: number
          valor: number
        }
        Insert: {
          bar_id?: string | null
          cartao?: string | null
          categoria?: string | null
          created_at?: string
          data: string
          id?: string
          is_chopp?: boolean
          produto: string
          quantidade?: number
          valor?: number
        }
        Update: {
          bar_id?: string | null
          cartao?: string | null
          categoria?: string | null
          created_at?: string
          data?: string
          id?: string
          is_chopp?: boolean
          produto?: string
          quantidade?: number
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "meep_vendas_bar_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_barris: {
        Row: {
          destino: string | null
          id: string
          marca: string | null
          move_type: string | null
          nf_id: string | null
          origem: string | null
          quantidade: number
          refill_id: string | null
          timestamp: string
          user_id: string | null
        }
        Insert: {
          destino?: string | null
          id?: string
          marca?: string | null
          move_type?: string | null
          nf_id?: string | null
          origem?: string | null
          quantidade: number
          refill_id?: string | null
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          destino?: string | null
          id?: string
          marca?: string | null
          move_type?: string | null
          nf_id?: string | null
          origem?: string | null
          quantidade?: number
          refill_id?: string | null
          timestamp?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_barris_nf_id_fkey"
            columns: ["nf_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_fiscais: {
        Row: {
          amstel_cheios: number
          amstel_vazios: number
          arquivo_url: string | null
          barris_cheios_solicitados: number
          barris_vazios_devolvidos: number
          conciliado_at: string | null
          conciliado_by: string | null
          created_at: string
          created_by: string | null
          data_emissao: string | null
          fornecedor: string
          heineken_cheios: number
          heineken_vazios: number
          id: string
          notes: string | null
          numero_nf: string
          status: string
          status_comodato: string
          updated_at: string
        }
        Insert: {
          amstel_cheios?: number
          amstel_vazios?: number
          arquivo_url?: string | null
          barris_cheios_solicitados?: number
          barris_vazios_devolvidos?: number
          conciliado_at?: string | null
          conciliado_by?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          fornecedor?: string
          heineken_cheios?: number
          heineken_vazios?: number
          id?: string
          notes?: string | null
          numero_nf: string
          status?: string
          status_comodato?: string
          updated_at?: string
        }
        Update: {
          amstel_cheios?: number
          amstel_vazios?: number
          arquivo_url?: string | null
          barris_cheios_solicitados?: number
          barris_vazios_devolvidos?: number
          conciliado_at?: string | null
          conciliado_by?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          fornecedor?: string
          heineken_cheios?: number
          heineken_vazios?: number
          id?: string
          notes?: string | null
          numero_nf?: string
          status?: string
          status_comodato?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      public_maintenance_requests: {
        Row: {
          bar_id: string
          completed_at: string | null
          completed_by: string | null
          completed_notes: string | null
          created_at: string
          description: string
          id: string
          latitude: number | null
          longitude: number | null
          photo_path: string | null
          requester_name: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          bar_id: string
          completed_at?: string | null
          completed_by?: string | null
          completed_notes?: string | null
          created_at?: string
          description: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          photo_path?: string | null
          requester_name?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          bar_id?: string
          completed_at?: string | null
          completed_by?: string | null
          completed_notes?: string | null
          created_at?: string
          description?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          photo_path?: string | null
          requester_name?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_maintenance_requests_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_tokens: {
        Row: {
          assigned_at: string | null
          bar_id: string | null
          code: string
          created_at: string
          id: string
          label: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          bar_id?: string | null
          code: string
          created_at?: string
          id?: string
          label?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          bar_id?: string | null
          code?: string
          created_at?: string
          id?: string
          label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_tokens_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      refill_items: {
        Row: {
          brand: Database["public"]["Enums"]["chopp_brand"]
          id: string
          quantidade: number
          refill_id: string
        }
        Insert: {
          brand: Database["public"]["Enums"]["chopp_brand"]
          id?: string
          quantidade?: number
          refill_id: string
        }
        Update: {
          brand?: Database["public"]["Enums"]["chopp_brand"]
          id?: string
          quantidade?: number
          refill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refill_items_refill_id_fkey"
            columns: ["refill_id"]
            isOneToOne: false
            referencedRelation: "refills"
            referencedColumns: ["id"]
          },
        ]
      }
      refills: {
        Row: {
          bar_id: string
          client_op_id: string | null
          created_at: string
          id: string
          notes: string | null
          performed_at: string
          performed_by: string
          photo_url: string | null
        }
        Insert: {
          bar_id: string
          client_op_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          performed_at?: string
          performed_by: string
          photo_url?: string | null
        }
        Update: {
          bar_id?: string
          client_op_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          performed_at?: string
          performed_by?: string
          photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refills_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      rotas: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      test_dispel: {
        Row: {
          id: string
          nome: string
        }
        Insert: {
          id?: string
          nome: string
        }
        Update: {
          id?: string
          nome?: string
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
      warehouse_empty_stock: {
        Row: {
          barrels: number
          brand: Database["public"]["Enums"]["chopp_brand"]
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          barrels?: number
          brand: Database["public"]["Enums"]["chopp_brand"]
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          barrels?: number
          brand?: Database["public"]["Enums"]["chopp_brand"]
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_empty_stock_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_movements: {
        Row: {
          bar_id: string | null
          brand: Database["public"]["Enums"]["chopp_brand"]
          direction: number
          id: string
          move_type: Database["public"]["Enums"]["warehouse_move_type"]
          notes: string | null
          performed_at: string
          performed_by: string | null
          photo_url: string | null
          quantidade: number
          refill_id: string | null
          target_warehouse_id: string | null
          warehouse_id: string
        }
        Insert: {
          bar_id?: string | null
          brand: Database["public"]["Enums"]["chopp_brand"]
          direction: number
          id?: string
          move_type: Database["public"]["Enums"]["warehouse_move_type"]
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          photo_url?: string | null
          quantidade: number
          refill_id?: string | null
          target_warehouse_id?: string | null
          warehouse_id: string
        }
        Update: {
          bar_id?: string | null
          brand?: Database["public"]["Enums"]["chopp_brand"]
          direction?: number
          id?: string
          move_type?: Database["public"]["Enums"]["warehouse_move_type"]
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          photo_url?: string | null
          quantidade?: number
          refill_id?: string | null
          target_warehouse_id?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_movements_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_movements_refill_id_fkey"
            columns: ["refill_id"]
            isOneToOne: false
            referencedRelation: "refills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_movements_target_warehouse_id_fkey"
            columns: ["target_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_stock: {
        Row: {
          barrels: number
          brand: Database["public"]["Enums"]["chopp_brand"]
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          barrels?: number
          brand: Database["public"]["Enums"]["chopp_brand"]
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          barrels?: number
          brand?: Database["public"]["Enums"]["chopp_brand"]
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_stock_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_vasilhames: {
        Row: {
          barrels: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          barrels?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          barrels?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_vasilhames_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: true
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      meep_abastecimento_bar: {
        Row: {
          bar_id: string | null
          cartao: string | null
          categoria: string | null
          created_at: string | null
          data: string | null
          id: string | null
          is_chopp: boolean | null
          produto: string | null
          quantidade: number | null
          valor: number | null
        }
        Insert: {
          bar_id?: string | null
          cartao?: string | null
          categoria?: string | null
          created_at?: string | null
          data?: string | null
          id?: string | null
          is_chopp?: boolean | null
          produto?: string | null
          quantidade?: number | null
          valor?: number | null
        }
        Update: {
          bar_id?: string | null
          cartao?: string | null
          categoria?: string | null
          created_at?: string | null
          data?: string | null
          id?: string | null
          is_chopp?: boolean | null
          produto?: string | null
          quantidade?: number | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meep_vendas_bar_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      meep_entregue_bar: {
        Row: {
          bar_id: string | null
          bar_nome: string | null
          barris_entregues: number | null
          created_at: string | null
          data: string | null
          id: string | null
          marca: string | null
        }
        Insert: {
          bar_id?: string | null
          bar_nome?: string | null
          barris_entregues?: number | null
          created_at?: string | null
          data?: string | null
          id?: string | null
          marca?: string | null
        }
        Update: {
          bar_id?: string | null
          bar_nome?: string | null
          barris_entregues?: number | null
          created_at?: string | null
          data?: string | null
          id?: string | null
          marca?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meep_consumo_bar_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      balanco_barris: {
        Args: never
        Returns: {
          allstar_cheio: number
          allstar_vazio: number
          bar_fechado: number
          bar_plugado: number
          bar_vazio: number
          devolvido: number
          disp_cheio: number
          em_maos: number
          marca: string
          pontos_allstar_cheio: number
          pontos_allstar_vazio: number
          quebra: number
          rastreavel: number
          recebido: number
          vasilhames_dispel: number
        }[]
      }
      conciliar_nota_fiscal: {
        Args: {
          _amstel_cheios: number
          _amstel_vazios: number
          _heineken_cheios: number
          _heineken_vazios: number
          _nf_id: string
        }
        Returns: undefined
      }
      conferir_abastecimento_meep: {
        Args: never
        Returns: {
          app: number
          bar_nome: string
          diferenca: number
          marca: string
          meep: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "gestor" | "operador" | "manutencao" | "equipe_bar" | "admin"
      bar_type: "camarote" | "stand" | "haras" | "bar_venda" | "bar_parceiro"
      barrel_status: "plugado" | "fechado" | "vazio"
      chopp_brand: "heineken" | "amstel"
      empty_move_origin:
        | "recolhimento_bar"
        | "devolucao_heineken"
        | "transferencia"
        | "ajuste"
      shift_slot: "t_07_19" | "t_10_22" | "t_13_01"
      temp_slot: "t_11" | "t_17" | "t_22"
      warehouse_move_type:
        | "entrada"
        | "transferencia"
        | "abastecimento_bar"
        | "ajuste"
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
      app_role: ["gestor", "operador", "manutencao", "equipe_bar", "admin"],
      bar_type: ["camarote", "stand", "haras", "bar_venda", "bar_parceiro"],
      barrel_status: ["plugado", "fechado", "vazio"],
      chopp_brand: ["heineken", "amstel"],
      empty_move_origin: [
        "recolhimento_bar",
        "devolucao_heineken",
        "transferencia",
        "ajuste",
      ],
      shift_slot: ["t_07_19", "t_10_22", "t_13_01"],
      temp_slot: ["t_11", "t_17", "t_22"],
      warehouse_move_type: [
        "entrada",
        "transferencia",
        "abastecimento_bar",
        "ajuste",
      ],
    },
  },
} as const
