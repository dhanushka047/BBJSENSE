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

    const url = new URL(req.url);

    // GET: Return device config for sync (polled by ESP32)
    if (req.method === "GET") {
      const mac = url.searchParams.get("mac");
      if (!mac) {
        return new Response(JSON.stringify({ error: "mac query param required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: device, error: devErr } = await supabase
        .from("devices")
        .select("id, modbus_address")
        .eq("mac_address", mac)
        .single();

      if (devErr || !device) {
        return new Response(JSON.stringify({ error: "Device not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get channel config for sync
      const { data: configs } = await supabase
        .from("device_channel_config")
        .select("channel_type, channel_number, label, data_mode, unit, min_value, max_value")
        .eq("device_id", device.id);

      // Get latest DO states
      const { data: latestReading } = await supabase
        .from("device_readings")
        .select("digital_out1, digital_out2, digital_out3, digital_out4")
        .eq("device_id", device.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          device_id: device.id,
          modbus_address: device.modbus_address,
          channel_config: configs || [],
          digital_out: latestReading ? {
            do1: latestReading.digital_out1,
            do2: latestReading.digital_out2,
            do3: latestReading.digital_out3,
            do4: latestReading.digital_out4,
          } : null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST: Ingest data
    const body = await req.json();
    const { mac_address, analog, digital_in, digital_out, rtc_time } = body;

    if (!mac_address) {
      return new Response(JSON.stringify({ error: "mac_address is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: device, error: deviceError } = await supabase
      .from("devices")
      .select("id")
      .eq("mac_address", mac_address)
      .single();

    if (deviceError || !device) {
      return new Response(JSON.stringify({ error: "Device not found. Register the device first." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reading: Record<string, unknown> = {
      device_id: device.id,
      rtc_time: rtc_time || null,
    };

    if (analog) {
      if (analog.ch1) { reading.analog_ch1 = analog.ch1.value; reading.analog_ch1_mode = analog.ch1.mode || "0-10V"; }
      if (analog.ch2) { reading.analog_ch2 = analog.ch2.value; reading.analog_ch2_mode = analog.ch2.mode || "0-10V"; }
      if (analog.ch3) { reading.analog_ch3 = analog.ch3.value; reading.analog_ch3_mode = analog.ch3.mode || "0-10V"; }
      if (analog.ch4) { reading.analog_ch4 = analog.ch4.value; reading.analog_ch4_mode = analog.ch4.mode || "0-10V"; }

      // Auto-detect mode from value range if mode not provided
      for (let i = 1; i <= 4; i++) {
        const chKey = `ch${i}`;
        const modeKey = `analog_ch${i}_mode`;
        if (analog[chKey] && !analog[chKey].mode) {
          const val = analog[chKey].value;
          // If value > 10, likely 4-20mA; if <= 10, likely 0-10V
          reading[modeKey] = val > 10 ? "4-20mA" : "0-10V";
        }
      }
    }

    if (digital_in) {
      reading.digital_in1 = digital_in.di1 ?? false;
      reading.digital_in2 = digital_in.di2 ?? false;
      reading.digital_in3 = digital_in.di3 ?? false;
      reading.digital_in4 = digital_in.di4 ?? false;
    }

    if (digital_out) {
      reading.digital_out1 = digital_out.do1 ?? false;
      reading.digital_out2 = digital_out.do2 ?? false;
      reading.digital_out3 = digital_out.do3 ?? false;
      reading.digital_out4 = digital_out.do4 ?? false;
    }

    const { data: insertedReading, error: readingError } = await supabase
      .from("device_readings")
      .insert(reading)
      .select("id")
      .single();

    if (readingError) {
      return new Response(JSON.stringify({ error: readingError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if device was previously offline — if so, log a "back online" event
    const { data: prevDevice } = await supabase
      .from("devices")
      .select("is_online")
      .eq("id", device.id)
      .single();

    await supabase
      .from("devices")
      .update({ is_online: true, last_seen_at: new Date().toISOString() })
      .eq("id", device.id);

    if (prevDevice && !prevDevice.is_online) {
      await supabase.from("device_events").insert({
        device_id: device.id,
        event_type: "info",
        message: "Device came back online",
      });
    }

    return new Response(
      JSON.stringify({ success: true, device_id: device.id, reading_id: insertedReading.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
