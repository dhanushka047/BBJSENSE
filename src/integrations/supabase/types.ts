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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      database_snapshots: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          snapshot_data: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          snapshot_data: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          snapshot_data?: Json
        }
        Relationships: []
      }
      device_channel_config: {
        Row: {
          channel_number: number
          channel_type: string
          created_at: string
          data_mode: string | null
          device_id: string
          id: string
          label: string
          max_value: number | null
          min_value: number | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          channel_number: number
          channel_type: string
          created_at?: string
          data_mode?: string | null
          device_id: string
          id?: string
          label?: string
          max_value?: number | null
          min_value?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          channel_number?: number
          channel_type?: string
          created_at?: string
          data_mode?: string | null
          device_id?: string
          id?: string
          label?: string
          max_value?: number | null
          min_value?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_channel_config_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_events: {
        Row: {
          created_at: string
          device_id: string
          event_type: string
          id: string
          message: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          device_id: string
          event_type?: string
          id?: string
          message: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string
          event_type?: string
          id?: string
          message?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_readings: {
        Row: {
          analog_ch1: number | null
          analog_ch1_mode: string | null
          analog_ch2: number | null
          analog_ch2_mode: string | null
          analog_ch3: number | null
          analog_ch3_mode: string | null
          analog_ch4: number | null
          analog_ch4_mode: string | null
          created_at: string
          device_id: string
          digital_in1: boolean | null
          digital_in2: boolean | null
          digital_in3: boolean | null
          digital_in4: boolean | null
          digital_out1: boolean | null
          digital_out2: boolean | null
          digital_out3: boolean | null
          digital_out4: boolean | null
          id: string
          rtc_time: string | null
        }
        Insert: {
          analog_ch1?: number | null
          analog_ch1_mode?: string | null
          analog_ch2?: number | null
          analog_ch2_mode?: string | null
          analog_ch3?: number | null
          analog_ch3_mode?: string | null
          analog_ch4?: number | null
          analog_ch4_mode?: string | null
          created_at?: string
          device_id: string
          digital_in1?: boolean | null
          digital_in2?: boolean | null
          digital_in3?: boolean | null
          digital_in4?: boolean | null
          digital_out1?: boolean | null
          digital_out2?: boolean | null
          digital_out3?: boolean | null
          digital_out4?: boolean | null
          id?: string
          rtc_time?: string | null
        }
        Update: {
          analog_ch1?: number | null
          analog_ch1_mode?: string | null
          analog_ch2?: number | null
          analog_ch2_mode?: string | null
          analog_ch3?: number | null
          analog_ch3_mode?: string | null
          analog_ch4?: number | null
          analog_ch4_mode?: string | null
          created_at?: string
          device_id?: string
          digital_in1?: boolean | null
          digital_in2?: boolean | null
          digital_in3?: boolean | null
          digital_in4?: boolean | null
          digital_out1?: boolean | null
          digital_out2?: boolean | null
          digital_out3?: boolean | null
          digital_out4?: boolean | null
          id?: string
          rtc_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_readings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          approval_status: Database["public"]["Enums"]["device_status"]
          approved_by: string | null
          created_at: string
          id: string
          is_online: boolean
          last_seen_at: string | null
          mac_address: string
          modbus_address: string | null
          wifi_max_disconnect_time: number
          led_disabled: boolean
          name: string
          nickname: string | null
          owner_id: string | null
          updated_at: string
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["device_status"]
          approved_by?: string | null
          created_at?: string
          id?: string
          is_online?: boolean
          last_seen_at?: string | null
          mac_address: string
          modbus_address?: string | null
          wifi_max_disconnect_time?: number
          led_disabled?: boolean
          name?: string
          nickname?: string | null
          owner_id?: string | null
          updated_at?: string
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["device_status"]
          approved_by?: string | null
          created_at?: string
          id?: string
          is_online?: boolean
          last_seen_at?: string | null
          mac_address?: string
          modbus_address?: string | null
          wifi_max_disconnect_time?: number
          led_disabled?: boolean
          name?: string
          nickname?: string | null
          owner_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      modbus_devices: {
        Row: {
          baud_rate: number
          created_at: string
          data_bits: number
          device_id: string
          id: string
          manufacturer: string | null
          name: string
          parity: string
          slave_id: number
          stop_bits: number
          updated_at: string
        }
        Insert: {
          baud_rate?: number
          created_at?: string
          data_bits?: number
          device_id: string
          id?: string
          manufacturer?: string | null
          name: string
          parity?: string
          slave_id?: number
          stop_bits?: number
          updated_at?: string
        }
        Update: {
          baud_rate?: number
          created_at?: string
          data_bits?: number
          device_id?: string
          id?: string
          manufacturer?: string | null
          name?: string
          parity?: string
          slave_id?: number
          stop_bits?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modbus_devices_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          }
        ]
      }
      modbus_registers: {
        Row: {
          address: number
          created_at: string
          data_type: string
          display_order: number
          function_code: number
          group_name: string | null
          id: string
          label: string
          modbus_device_id: string
          scale: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          address: number
          created_at?: string
          data_type?: string
          display_order?: number
          function_code?: number
          group_name?: string | null
          id?: string
          label: string
          modbus_device_id: string
          scale?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          address?: number
          created_at?: string
          data_type?: string
          display_order?: number
          function_code?: number
          group_name?: string | null
          id?: string
          label?: string
          modbus_device_id?: string
          scale?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modbus_registers_modbus_device_id_fkey"
            columns: ["modbus_device_id"]
            isOneToOne: false
            referencedRelation: "modbus_devices"
            referencedColumns: ["id"]
          }
        ]
      }
      modbus_readings: {
        Row: {
          created_at: string
          id: string
          modbus_device_id: string
          raw_value: string | null
          register_id: string
          scaled_value: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          modbus_device_id: string
          raw_value?: string | null
          register_id: string
          scaled_value?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          modbus_device_id?: string
          raw_value?: string | null
          register_id?: string
          scaled_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "modbus_readings_modbus_device_id_fkey"
            columns: ["modbus_device_id"]
            isOneToOne: false
            referencedRelation: "modbus_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modbus_readings_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "modbus_registers"
            referencedColumns: ["id"]
          }
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_on_alert: boolean
          email_on_offline: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_on_alert?: boolean
          email_on_offline?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_on_alert?: boolean
          email_on_offline?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          factory_name: string
          first_name: string
          id: string
          last_name: string
          location: string
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string
          factory_name?: string
          first_name?: string
          id?: string
          last_name?: string
          location?: string
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          factory_name?: string
          first_name?: string
          id?: string
          last_name?: string
          location?: string
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      app_role: "super_admin" | "admin" | "user"
      device_status: "pending" | "approved" | "rejected"
      subscription_status: "active" | "suspended"
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
      app_role: ["super_admin", "admin", "user"],
      device_status: ["pending", "approved", "rejected"],
      subscription_status: ["active", "suspended"],
    },
  },
} as const
