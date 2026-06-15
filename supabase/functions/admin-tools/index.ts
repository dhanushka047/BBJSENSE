import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Check super_admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (!roleData || roleData.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Super admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "clear_database") {
      // Delete in order: readings, events, channel_config, devices, notification_preferences
      // Keep: profiles, user_roles (auth-related)
      await supabase.from("device_readings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("device_events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("device_channel_config").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("devices").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      return new Response(
        JSON.stringify({ success: true, message: "All device data cleared. Auth data preserved." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "seed_dummy_data") {
      // Create 4 dummy devices owned by current user
      const devices = [
        { mac_address: "AA:BB:CC:11:22:01", name: "Pump Station A", nickname: "Main Pump", owner_id: userId, approval_status: "approved" as const, approved_by: userId, is_online: true, last_seen_at: new Date().toISOString(), modbus_address: "0x01" },
        { mac_address: "AA:BB:CC:11:22:02", name: "Compressor Unit B", nickname: "Compressor #2", owner_id: userId, approval_status: "approved" as const, approved_by: userId, is_online: true, last_seen_at: new Date().toISOString(), modbus_address: "0x02" },
        { mac_address: "AA:BB:CC:11:22:03", name: "HVAC Controller C", nickname: "HVAC Zone 1", owner_id: userId, approval_status: "approved" as const, approved_by: userId, is_online: false, last_seen_at: new Date(Date.now() - 3600000).toISOString(), modbus_address: "0x03" },
        { mac_address: "AA:BB:CC:11:22:04", name: "Flow Meter D", nickname: "", owner_id: userId, approval_status: "pending" as const, is_online: false, modbus_address: "0x04" },
      ];

      const { data: insertedDevices, error: devErr } = await supabase
        .from("devices")
        .upsert(devices, { onConflict: "mac_address" })
        .select("id, mac_address, name");

      if (devErr) {
        return new Response(JSON.stringify({ error: devErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // For each approved device, generate channel configs + readings + events
      for (const dev of insertedDevices || []) {
        const deviceMac = dev.mac_address;
        const isApproved = devices.find(d => d.mac_address === deviceMac)?.approval_status === "approved";

        if (!isApproved) continue;

        // Channel configs
        const configs = [
          { device_id: dev.id, channel_type: "analog", channel_number: 1, label: "Pressure", data_mode: "4-20mA", unit: "mA", min_value: 4, max_value: 20 },
          { device_id: dev.id, channel_type: "analog", channel_number: 2, label: "Temperature", data_mode: "0-10V", unit: "V", min_value: 0, max_value: 10 },
          { device_id: dev.id, channel_type: "analog", channel_number: 3, label: "Flow Rate", data_mode: "4-20mA", unit: "mA", min_value: 4, max_value: 20 },
          { device_id: dev.id, channel_type: "analog", channel_number: 4, label: "Humidity", data_mode: "0-10V", unit: "V", min_value: 0, max_value: 10 },
          { device_id: dev.id, channel_type: "digital_in", channel_number: 1, label: "Door Sensor", data_mode: "binary", unit: "", min_value: 0, max_value: 1 },
          { device_id: dev.id, channel_type: "digital_in", channel_number: 2, label: "Motion Detect", data_mode: "binary", unit: "", min_value: 0, max_value: 1 },
          { device_id: dev.id, channel_type: "digital_in", channel_number: 3, label: "Limit Switch", data_mode: "binary", unit: "", min_value: 0, max_value: 1 },
          { device_id: dev.id, channel_type: "digital_in", channel_number: 4, label: "Emergency", data_mode: "binary", unit: "", min_value: 0, max_value: 1 },
          { device_id: dev.id, channel_type: "digital_out", channel_number: 1, label: "Relay 1", data_mode: "binary", unit: "", min_value: 0, max_value: 1 },
          { device_id: dev.id, channel_type: "digital_out", channel_number: 2, label: "Relay 2", data_mode: "binary", unit: "", min_value: 0, max_value: 1 },
          { device_id: dev.id, channel_type: "digital_out", channel_number: 3, label: "Valve", data_mode: "binary", unit: "", min_value: 0, max_value: 1 },
          { device_id: dev.id, channel_type: "digital_out", channel_number: 4, label: "Alarm", data_mode: "binary", unit: "", min_value: 0, max_value: 1 },
        ];

        await supabase.from("device_channel_config").upsert(configs, {
          onConflict: "device_id,channel_type,channel_number",
        });

        // Generate 72 readings (6 hours, every 5 min)
        const readings = [];
        const now = Date.now();
        for (let i = 72; i >= 0; i--) {
          const t = new Date(now - i * 5 * 60 * 1000);
          readings.push({
            device_id: dev.id,
            analog_ch1: +(12 + Math.sin(i / 6) * 4 + Math.random() * 0.5).toFixed(2),
            analog_ch1_mode: "4-20mA",
            analog_ch2: +(3 + Math.cos(i / 4) * 2 + Math.random() * 0.3).toFixed(2),
            analog_ch2_mode: "0-10V",
            analog_ch3: +(8 + Math.sin(i / 8 + 1) * 5 + Math.random() * 0.4).toFixed(2),
            analog_ch3_mode: "4-20mA",
            analog_ch4: +(5 + Math.cos(i / 5 + 2) * 2 + Math.random() * 0.2).toFixed(2),
            analog_ch4_mode: "0-10V",
            digital_in1: i % 10 < 5,
            digital_in2: i % 7 < 3,
            digital_in3: i % 15 < 8,
            digital_in4: false,
            digital_out1: true,
            digital_out2: false,
            digital_out3: i % 20 < 10,
            digital_out4: false,
            rtc_time: t.toISOString(),
            created_at: t.toISOString(),
          });
        }
        await supabase.from("device_readings").insert(readings);

        // Generate events
        const events = [
          { device_id: dev.id, event_type: "info", message: `Device "${dev.name}" registered`, triggered_by: userId, created_at: new Date(now - 6 * 3600000).toISOString() },
          { device_id: dev.id, event_type: "control", message: "Device approved by admin", triggered_by: userId, created_at: new Date(now - 5.5 * 3600000).toISOString() },
          { device_id: dev.id, event_type: "info", message: "Device came online", created_at: new Date(now - 5 * 3600000).toISOString() },
          { device_id: dev.id, event_type: "control", message: "DO1 turned ON", triggered_by: userId, created_at: new Date(now - 3 * 3600000).toISOString() },
          { device_id: dev.id, event_type: "alert", message: "Pressure exceeded threshold (19.5 mA)", created_at: new Date(now - 1 * 3600000).toISOString() },
          { device_id: dev.id, event_type: "info", message: 'Channel analog 1 renamed to "Pressure"', triggered_by: userId, created_at: new Date(now - 0.5 * 3600000).toISOString() },
        ];
        await supabase.from("device_events").insert(events);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Seeded ${insertedDevices?.length || 0} devices with readings, configs, and events.`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
