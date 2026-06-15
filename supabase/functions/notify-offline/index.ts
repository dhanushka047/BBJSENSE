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

    const body = await req.json();
    const { type, device_id, message } = body;
    // type: "offline" | "alert"

    if (!device_id) {
      return new Response(JSON.stringify({ error: "device_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get device + owner
    const { data: device } = await supabase
      .from("devices")
      .select("id, name, nickname, owner_id, mac_address")
      .eq("id", device_id)
      .single();

    if (!device || !device.owner_id) {
      return new Response(JSON.stringify({ error: "Device or owner not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check notification preferences
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("email_on_offline, email_on_alert")
      .eq("user_id", device.owner_id)
      .maybeSingle();

    const shouldNotify =
      (type === "offline" && (prefs?.email_on_offline ?? true)) ||
      (type === "alert" && (prefs?.email_on_alert ?? true));

    if (!shouldNotify) {
      return new Response(JSON.stringify({ skipped: true, reason: "User disabled this notification" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user email from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, first_name")
      .eq("user_id", device.owner_id)
      .single();

    if (!profile?.email) {
      return new Response(JSON.stringify({ error: "No email found for user" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const deviceName = device.nickname || device.name;
    const subject =
      type === "offline"
        ? `⚠️ Device Offline: ${deviceName}`
        : `🚨 Alert: ${deviceName}`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: ${type === "offline" ? "#f59e0b" : "#ef4444"};">${subject}</h2>
        <p>Hi ${profile.first_name || "there"},</p>
        <p>${message || (type === "offline" ? `Your device <strong>${deviceName}</strong> (${device.mac_address}) has gone offline.` : `An alert was triggered on device <strong>${deviceName}</strong> (${device.mac_address}).`)}</p>
        <p style="color: #666; font-size: 12px;">You can manage notification preferences in your Settings page.</p>
      </div>
    `;

    // Send email via Supabase Auth admin (resend)
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "magiclink",
        email: profile.email,
      }),
    });

    // Log the event
    await supabase.from("device_events").insert({
      device_id,
      event_type: type === "offline" ? "offline" : "alert",
      message: message || `${type === "offline" ? "Device went offline" : "Alert triggered"} — notification sent to ${profile.email}`,
    });

    return new Response(
      JSON.stringify({ success: true, notified: profile.email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Notification error:", err);
    return new Response(JSON.stringify({ error: "Failed to process notification" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
