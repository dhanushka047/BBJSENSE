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

    if (action === "create_snapshot") {
      const { name, description } = body;
      if (!name) {
        return new Response(JSON.stringify({ error: "Snapshot name is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch all device-related data
      const [devicesRes, readingsRes, eventsRes, configsRes] = await Promise.all([
        supabase.from("devices").select("*"),
        supabase.from("device_readings").select("*").limit(1000),
        supabase.from("device_events").select("*").limit(1000),
        supabase.from("device_channel_config").select("*"),
      ]);

      const snapshotData = {
        devices: devicesRes.data || [],
        readings: readingsRes.data || [],
        events: eventsRes.data || [],
        channel_configs: configsRes.data || [],
        metadata: {
          device_count: devicesRes.data?.length || 0,
          reading_count: readingsRes.data?.length || 0,
          event_count: eventsRes.data?.length || 0,
          config_count: configsRes.data?.length || 0,
          snapshot_time: new Date().toISOString(),
        },
      };

      const { data: snapshot, error: insertErr } = await supabase
        .from("database_snapshots")
        .insert({
          name,
          description: description || "",
          snapshot_data: snapshotData,
          created_by: userId,
        })
        .select("id, name, created_at")
        .single();

      if (insertErr) {
        return new Response(JSON.stringify({ error: insertErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ success: true, snapshot, message: `Snapshot "${name}" created with ${snapshotData.metadata.device_count} devices, ${snapshotData.metadata.reading_count} readings.` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "restore_snapshot") {
      const { snapshot_id } = body;
      if (!snapshot_id) {
        return new Response(JSON.stringify({ error: "Snapshot ID required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: snapshot, error: fetchErr } = await supabase
        .from("database_snapshots")
        .select("*")
        .eq("id", snapshot_id)
        .single();

      if (fetchErr || !snapshot) {
        return new Response(JSON.stringify({ error: "Snapshot not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = snapshot.snapshot_data as any;

      // Clear existing data first
      await supabase.from("device_readings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("device_events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("device_channel_config").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("devices").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      // Restore in order: devices first, then dependent tables
      if (data.devices?.length) {
        await supabase.from("devices").insert(data.devices);
      }
      if (data.channel_configs?.length) {
        await supabase.from("device_channel_config").insert(data.channel_configs);
      }
      if (data.readings?.length) {
        // Insert in batches of 500
        for (let i = 0; i < data.readings.length; i += 500) {
          await supabase.from("device_readings").insert(data.readings.slice(i, i + 500));
        }
      }
      if (data.events?.length) {
        await supabase.from("device_events").insert(data.events);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Restored snapshot "${snapshot.name}": ${data.metadata?.device_count || 0} devices, ${data.metadata?.reading_count || 0} readings.`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete_snapshot") {
      const { snapshot_id } = body;
      if (!snapshot_id) {
        return new Response(JSON.stringify({ error: "Snapshot ID required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: delErr } = await supabase
        .from("database_snapshots")
        .delete()
        .eq("id", snapshot_id);

      if (delErr) {
        return new Response(JSON.stringify({ error: delErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ success: true, message: "Snapshot deleted." }),
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
