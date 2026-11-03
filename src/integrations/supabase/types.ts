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
      analisis_ia: {
        Row: {
          created_at: string
          estado: string
          fecha_local: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estado?: string
          fecha_local: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          estado?: string
          fecha_local?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      comidas: {
        Row: {
          azucares_g: number
          calorias: number
          carbohidratos_g: number
          confianza: string | null
          created_at: string
          descripcion: string | null
          fecha: string
          fibra_g: number
          foto_path: string | null
          grasas_g: number
          grasas_saturadas_g: number
          id: string
          ingredientes: Json
          kcal_max: number | null
          kcal_min: number | null
          momento: string
          nombre: string
          origen: string
          proteinas_g: number
          sodio_mg: number
          updated_at: string
          user_id: string
        }
        Insert: {
          azucares_g?: number
          calorias?: number
          carbohidratos_g?: number
          confianza?: string | null
          created_at?: string
          descripcion?: string | null
          fecha: string
          fibra_g?: number
          foto_path?: string | null
          grasas_g?: number
          grasas_saturadas_g?: number
          id?: string
          ingredientes?: Json
          kcal_max?: number | null
          kcal_min?: number | null
          momento: string
          nombre: string
          origen?: string
          proteinas_g?: number
          sodio_mg?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          azucares_g?: number
          calorias?: number
          carbohidratos_g?: number
          confianza?: string | null
          created_at?: string
          descripcion?: string | null
          fecha?: string
          fibra_g?: number
          foto_path?: string | null
          grasas_g?: number
          grasas_saturadas_g?: number
          id?: string
          ingredientes?: Json
          kcal_max?: number | null
          kcal_min?: number | null
          momento?: string
          nombre?: string
          origen?: string
          proteinas_g?: number
          sodio_mg?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      metas_diarias: {
        Row: {
          azucares_g: number | null
          calorias: number
          carbohidratos_g: number
          fibra_g: number | null
          grasas_g: number
          grasas_saturadas_g: number | null
          proteinas_g: number
          sodio_mg: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          azucares_g?: number | null
          calorias?: number
          carbohidratos_g?: number
          fibra_g?: number | null
          grasas_g?: number
          grasas_saturadas_g?: number | null
          proteinas_g?: number
          sodio_mg?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          azucares_g?: number | null
          calorias?: number
          carbohidratos_g?: number
          fibra_g?: number | null
          grasas_g?: number
          grasas_saturadas_g?: number | null
          proteinas_g?: number
          sodio_mg?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          altura_cm: number | null
          created_at: string
          edad: number | null
          id: string
          limite_analisis_diario: number
          nivel_actividad: string | null
          nombre: string | null
          objetivo: string | null
          onboarding_completo: boolean
          peso_kg: number | null
          sexo: string | null
        }
        Insert: {
          altura_cm?: number | null
          created_at?: string
          edad?: number | null
          id: string
          limite_analisis_diario?: number
          nivel_actividad?: string | null
          nombre?: string | null
          objetivo?: string | null
          onboarding_completo?: boolean
          peso_kg?: number | null
          sexo?: string | null
        }
        Update: {
          altura_cm?: number | null
          created_at?: string
          edad?: number | null
          id?: string
          limite_analisis_diario?: number
          nivel_actividad?: string | null
          nombre?: string | null
          objetivo?: string | null
          onboarding_completo?: boolean
          peso_kg?: number | null
          sexo?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
