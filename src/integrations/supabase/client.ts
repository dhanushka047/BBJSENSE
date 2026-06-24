/**
 * client.ts
 * Supabase Client Adapter.
 * Redirects all queries, authentication, and real-time subscriptions
 * to the backend Express server (REST + WebSockets).
 */

const API_BASE_URL = "http://localhost:5001/api";
const WS_URL = "ws://localhost:5001/ws";
const TOKEN_KEY = "bbjsense_auth_token";

// Helper to get headers with JWT token
function getHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// ── Shared WebSocket Manager for Real-time Subscriptions ────────────────────
class WebSocketManager {
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, Set<(payload: any) => void>>();
  private reconnectTimeout: any = null;

  constructor() {
    this.connect();
  }

  private connect() {
    if (this.ws) return;

    console.log("[WS-Client] Connecting to WebSocket server...");
    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      console.log("[WS-Client] Connected to WebSocket server");
      // Re-subscribe to all active topics on reconnect
      for (const topic of this.subscriptions.keys()) {
        this.sendSubscribe(topic);
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { topic, event: eventType, payload } = message;

        if (this.subscriptions.has(topic)) {
          const listeners = this.subscriptions.get(topic);
          if (listeners) {
            // Emulate Supabase Postgres Changes payload structure
            const supabasePayload = {
              schema: "public",
              table: this.getTableFromTopic(topic),
              commit_timestamp: new Date().toISOString(),
              eventType: eventType, // 'INSERT', 'UPDATE', 'DELETE'
              new: eventType !== "DELETE" ? payload : {},
              old: eventType === "DELETE" ? payload : {},
            };

            listeners.forEach((cb) => cb(supabasePayload));
          }
        }
      } catch (err) {
        console.error("[WS-Client] Error handling message:", err);
      }
    };

    this.ws.onclose = () => {
      console.log("[WS-Client] Disconnected, scheduling reconnect...");
      this.ws = null;
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = (err) => {
      console.error("[WS-Client] WebSocket error:", err);
    };
  }

  private sendSubscribe(topic: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: "subscribe", topic }));
    }
  }

  private sendUnsubscribe(topic: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: "unsubscribe", topic }));
    }
  }

  subscribe(topic: string, callback: (payload: any) => void) {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
      this.sendSubscribe(topic);
    }
    this.subscriptions.get(topic)!.add(callback);

    return () => {
      const listeners = this.subscriptions.get(topic);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.subscriptions.delete(topic);
          this.sendUnsubscribe(topic);
        }
      }
    };
  }

  private getTableFromTopic(topic: string): string {
    if (topic.startsWith("device-readings-")) return "device_readings";
    if (topic.startsWith("device-events-")) return "device_events";
    if (topic.startsWith("modbus_readings-")) return "modbus_readings";
    return topic; // e.g. 'devices'
  }
}

const wsManager = new WebSocketManager();

// ── Auth System ─────────────────────────────────────────────────────────────
class AuthClient {
  private listeners: ((event: string, session: any) => void)[] = [];

  constructor() {
    // Check session validity on startup
    this.getSession();
  }

  async signInWithPassword({ email, password }: any) {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { data: null, error: new Error(data.error || "Login failed") };
      }

      localStorage.setItem(TOKEN_KEY, data.session.access_token);
      this.trigger("SIGNED_IN", data.session);
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  async signUp({ email, password, options }: any) {
    try {
      const meta = options?.data || {};
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          first_name: meta.first_name || "",
          last_name: meta.last_name || "",
          factory_name: meta.factory_name || "",
          location: meta.location || "",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { data: null, error: new Error(data.error || "Registration failed") };
      }

      localStorage.setItem(TOKEN_KEY, data.session.access_token);
      this.trigger("SIGNED_IN", data.session);
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  async signOut() {
    localStorage.removeItem(TOKEN_KEY);
    this.trigger("SIGNED_OUT", null);
    return { error: null };
  }

  async getSession() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      return { data: { session: null }, error: null };
    }

    try {
      const res = await fetch(`${API_BASE_URL}/auth/session`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        localStorage.removeItem(TOKEN_KEY);
        this.trigger("SIGNED_OUT", null);
        return { data: { session: null }, error: null };
      }

      return { data: { session: data.session }, error: null };
    } catch (err: any) {
      return { data: { session: null }, error: err };
    }
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    this.listeners.push(callback);
    this.getSession().then(({ data }) => {
      callback(data?.session ? "SIGNED_IN" : "SIGNED_OUT", data?.session);
    });

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners = this.listeners.filter((l) => l !== callback);
          },
        },
      },
    };
  }

  private trigger(event: string, session: any) {
    this.listeners.forEach((l) => l(event, session));
  }
}

// ── REST Query Builder (Translates supabase chaining to REST calls) ──────────
class RestQueryBuilder {
  private table: string;
  private isSelect = false;
  private isInsert = false;
  private insertData: any = null;
  private isUpdate = false;
  private updateData: any = null;
  private isDelete = false;
  private isUpsert = false;
  private upsertData: any = null;
  
  private filters: { col: string; val: any; op: string }[] = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitCount: number | null = null;
  private expectSingle = false;

  constructor(table: string) {
    this.table = table;
  }

  select(cols: string = "*") {
    this.isSelect = true;
    return this;
  }

  insert(data: any) {
    this.isInsert = true;
    this.insertData = data;
    return this;
  }

  update(data: any) {
    this.isUpdate = true;
    this.updateData = data;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  upsert(data: any, options?: any) {
    this.isUpsert = true;
    this.upsertData = data;
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push({ col, val, op: "=" });
    return this;
  }

  neq(col: string, val: any) {
    this.filters.push({ col, val, op: "!=" });
    return this;
  }

  gte(col: string, val: any) {
    this.filters.push({ col, val, op: ">=" });
    return this;
  }

  order(col: string, options?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = options?.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.expectSingle = true;
    return this;
  }

  maybeSingle() {
    this.expectSingle = true;
    return this;
  }

  // Executes query when awaited
  async then(onfulfilled: (res: any) => void) {
    try {
      const res = await this.execute();
      onfulfilled(res);
    } catch (err) {
      onfulfilled({ data: null, error: err });
    }
  }

  private getFilterValue(col: string): any {
    const filter = this.filters.find((f) => f.col === col && f.op === "=");
    return filter ? filter.val : null;
  }

  private async execute(): Promise<{ data: any; error: any }> {
    const idFilter = this.getFilterValue("id");
    const deviceIdFilter = this.getFilterValue("device_id") || this.getFilterValue("modbus_device_id");
    const userIdFilter = this.getFilterValue("user_id") || this.getFilterValue("created_by");

    let url = "";
    let method = "GET";
    let body: any = null;

    // 1. Map tables to specific REST routes
    if (this.table === "devices") {
      if (this.isSelect) {
        url = idFilter ? `${API_BASE_URL}/devices/${idFilter}` : `${API_BASE_URL}/devices`;
        const params = [];
        const statusFilter = this.getFilterValue("approval_status");
        if (statusFilter) params.push(`approval_status=${statusFilter}`);
        const ownerFilter = this.getFilterValue("owner_id");
        if (ownerFilter) params.push(`owner_id=${ownerFilter}`);
        if (params.length > 0 && !idFilter) {
          url += `?${params.join("&")}`;
        }
      } else if (this.isInsert) {
        url = `${API_BASE_URL}/devices`;
        method = "POST";
        body = this.insertData;
      } else if (this.isUpdate) {
        url = `${API_BASE_URL}/devices/${idFilter}`;
        method = "PUT";
        body = this.updateData;
      } else if (this.isDelete) {
        url = `${API_BASE_URL}/devices/${idFilter}`;
        method = "DELETE";
      }
    } 
    
    else if (this.table === "device_readings") {
      if (this.isSelect) {
        url = `${API_BASE_URL}/device-readings?device_id=${deviceIdFilter}`;
        if (this.limitCount) url += `&limit=${this.limitCount}`;
        if (this.orderCol) url += `&order=${this.orderAsc ? "asc" : "desc"}`;
      } else if (this.isInsert) {
        url = `${API_BASE_URL}/device-readings`;
        method = "POST";
        body = this.insertData;
      }
    } 
    
    else if (this.table === "device_events") {
      if (this.isSelect) {
        url = `${API_BASE_URL}/device-events`;
        const params = [];
        if (deviceIdFilter) params.push(`device_id=${deviceIdFilter}`);
        const typeFilter = this.getFilterValue("event_type");
        if (typeFilter) params.push(`event_type=${typeFilter}`);
        if (this.limitCount) params.push(`limit=${this.limitCount}`);
        if (params.length > 0) url += `?${params.join("&")}`;
      } else if (this.isInsert) {
        url = `${API_BASE_URL}/device-events`;
        method = "POST";
        body = this.insertData;
      }
    } 
    
    else if (this.table === "device_channel_config") {
      if (this.isSelect) {
        url = `${API_BASE_URL}/device-channel-config?device_id=${deviceIdFilter}`;
      } else if (this.isUpsert) {
        // Map upsert to batch update
        const configs = Array.isArray(this.upsertData) ? this.upsertData : [this.upsertData];
        const devId = configs[0]?.device_id || deviceIdFilter;
        url = `${API_BASE_URL}/device-channel-config/batch`;
        method = "POST";
        body = { device_id: devId, configs };
      }
    } 
    
    else if (this.table === "profiles") {
      const targetUserId = userIdFilter || idFilter;
      if (this.isSelect) {
        url = targetUserId ? `${API_BASE_URL}/profiles/${targetUserId}` : `${API_BASE_URL}/profiles`;
      } else if (this.isUpdate) {
        url = `${API_BASE_URL}/profiles/${targetUserId}`;
        method = "PUT";
        body = this.updateData;
      }
    } 
    
    else if (this.table === "notification_preferences") {
      const targetUserId = userIdFilter || idFilter;
      if (this.isSelect) {
        url = `${API_BASE_URL}/profiles/${targetUserId}/preferences`;
      } else if (this.isUpdate) {
        url = `${API_BASE_URL}/profiles/${targetUserId}/preferences`;
        method = "PUT";
        body = this.updateData;
      }
    } 
    
    else if (this.table === "user_roles") {
      if (this.isSelect) {
        url = userIdFilter ? `${API_BASE_URL}/profiles/${userIdFilter}` : `${API_BASE_URL}/profiles/roles`;
      } else if (this.isUpdate) {
        const targetUserId = userIdFilter || this.updateData?.user_id;
        url = `${API_BASE_URL}/profiles/${targetUserId}/role`;
        method = "PUT";
        body = { role: this.updateData.role };
      }
    }

    else if (this.table === "system_settings") {
      if (this.isSelect) {
        url = `${API_BASE_URL}/settings`;
      } else if (this.isInsert || this.isUpsert) {
        url = `${API_BASE_URL}/settings`;
        method = "POST";
        body = this.isInsert ? this.insertData : this.upsertData;
      }
    }

    else if (this.table === "database_snapshots") {
      if (this.isSelect) {
        url = idFilter ? `${API_BASE_URL}/backup/snapshots/${idFilter}` : `${API_BASE_URL}/backup/snapshots`;
      } else if (this.isInsert) {
        url = `${API_BASE_URL}/backup/snapshots`;
        method = "POST";
        body = this.insertData;
      } else if (this.isDelete) {
        url = `${API_BASE_URL}/backup/snapshots/${idFilter}`;
        method = "DELETE";
      }
    } 
    
    else if (this.table === "modbus_devices") {
      if (this.isSelect) {
        url = `${API_BASE_URL}/modbus/devices?device_id=${deviceIdFilter}`;
      } else if (this.isInsert) {
        url = `${API_BASE_URL}/modbus/devices`;
        method = "POST";
        body = this.insertData;
      } else if (this.isUpdate) {
        url = `${API_BASE_URL}/modbus/devices/${idFilter}`;
        method = "PUT";
        body = this.updateData;
      } else if (this.isDelete) {
        url = `${API_BASE_URL}/modbus/devices/${idFilter}`;
        method = "DELETE";
      }
    } 
    
    else if (this.table === "modbus_registers") {
      if (this.isSelect) {
        url = `${API_BASE_URL}/modbus/registers?modbus_device_id=${deviceIdFilter}`;
      } else if (this.isInsert || this.isUpsert) {
        url = `${API_BASE_URL}/modbus/registers`;
        method = "POST";
        body = this.isInsert ? this.insertData : this.upsertData;
      }
    } 
    
    else if (this.table === "modbus_readings") {
      if (this.isSelect) {
        url = `${API_BASE_URL}/modbus/readings?modbus_device_id=${deviceIdFilter}`;
        if (this.limitCount) url += `&limit=${this.limitCount}`;
      } else if (this.isInsert) {
        url = `${API_BASE_URL}/modbus/readings`;
        method = "POST";
        body = this.insertData;
      }
    } 
    
    else {
      return { data: null, error: new Error(`Unsupported table query: ${this.table}`) };
    }

    try {
      const options: RequestInit = {
        method,
        headers: getHeaders(),
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const res = await fetch(url, options);
      if (res.status === 204) {
        return { data: null, error: null };
      }

      const data = await res.json();
      if (!res.ok) {
        return { data: null, error: new Error(data.error || "Query execution failed") };
      }

      // Custom post-processing for compatibility
      let processedData = data;

      if (this.table === "user_roles" && this.isSelect) {
        if (userIdFilter) {
          // Map single profile response to role object
          const primaryRole = data.user?.roles?.[0]?.role || "user";
          processedData = { user_id: userIdFilter, role: primaryRole };
        } else if (Array.isArray(data)) {
          // Map GET /profiles/roles list
          processedData = data.map((r: any) => ({
            id: r.id,
            user_id: r.user_id,
            role: r.role,
          }));
        }
      }

      // Handle single item wrappers
      if (this.expectSingle && Array.isArray(processedData)) {
        return { data: processedData[0] || null, error: null };
      }

      return { data: processedData, error: null };
    } catch (err: any) {
      console.error(`REST query error [${method} ${url}]:`, err);
      return { data: null, error: err };
    }
  }
}

// ── Supabase Realtime Channel emulation ──────────────────────────────────────
class RealtimeChannel {
  private channelName: string;
  private listeners: { event: string; filter: any; callback: (payload: any) => void }[] = [];
  private unsubscribes: (() => void)[] = [];

  constructor(name: string) {
    this.channelName = name;
  }

  on(event: string, filter: any, callback: (payload: any) => void) {
    this.listeners.push({ event, filter, callback });
    return this;
  }

  subscribe() {
    console.log(`[WS-Client] Subscribing channel: ${this.channelName}`);
    
    this.listeners.forEach((listener) => {
      // Determine the WebSocket topic
      let topic = this.channelName;
      
      // If a generic channel name is used, map to the table filter
      if (this.channelName === "dashboard-devices-realtime" || this.channelName === "devices-list-realtime") {
        topic = "devices";
      }

      const unsubscribe = wsManager.subscribe(topic, (payload) => {
        // Filter by event type if requested
        if (listener.event === "*" || listener.event === payload.eventType) {
          listener.callback(payload);
        }
      });
      this.unsubscribes.push(unsubscribe);
    });

    return this;
  }

  unsubscribe() {
    console.log(`[WS-Client] Unsubscribing channel: ${this.channelName}`);
    this.unsubscribes.forEach((unsub) => unsub());
    this.unsubscribes = [];
  }
}

// ── Supabase Client Mock Singleton ───────────────────────────────────────────
class SupabaseMockClient {
  auth = new AuthClient();

  from(table: string) {
    return new RestQueryBuilder(table);
  }

  channel(name: string) {
    return new RealtimeChannel(name);
  }

  removeChannel(chan: RealtimeChannel) {
    if (chan && typeof chan.unsubscribe === "function") {
      chan.unsubscribe();
    }
  }
}

export const supabase: any = new SupabaseMockClient();