/**
 * localDb.ts
 * Browser-side SQLite database engine using sql.js.
 * Acts as the replacement for the remote Supabase database.
 * Auto-seeds default users, test devices, and metrics on first run.
 */

const DB_KEY = "bbjsense_local_db";
const SESSION_KEY = "bbjsense_auth_session";

// ── SQL Schema ──────────────────────────────────────────────────────────────
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  factory_name TEXT DEFAULT '',
  location TEXT DEFAULT '',
  subscription_status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  mac_address TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT 'New Device',
  nickname TEXT DEFAULT '',
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  approval_status TEXT DEFAULT 'pending',
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  is_online INTEGER DEFAULT 0,
  last_seen_at DATETIME,
  modbus_address TEXT DEFAULT '0x01',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_channel_config (
  id TEXT PRIMARY KEY,
  device_id TEXT REFERENCES devices(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL,
  channel_number INTEGER NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  data_mode TEXT DEFAULT '0-10V',
  unit TEXT DEFAULT '',
  min_value REAL DEFAULT 0,
  max_value REAL DEFAULT 10,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, channel_type, channel_number)
);

CREATE TABLE IF NOT EXISTS device_readings (
  id TEXT PRIMARY KEY,
  device_id TEXT REFERENCES devices(id) ON DELETE CASCADE,
  analog_ch1 REAL DEFAULT 0,
  analog_ch1_mode TEXT DEFAULT '0-10V',
  analog_ch2 REAL DEFAULT 0,
  analog_ch2_mode TEXT DEFAULT '0-10V',
  analog_ch3 REAL DEFAULT 0,
  analog_ch3_mode TEXT DEFAULT '0-10V',
  analog_ch4 REAL DEFAULT 0,
  analog_ch4_mode TEXT DEFAULT '0-10V',
  digital_in1 INTEGER DEFAULT 0,
  digital_in2 INTEGER DEFAULT 0,
  digital_in3 INTEGER DEFAULT 0,
  digital_in4 INTEGER DEFAULT 0,
  digital_out1 INTEGER DEFAULT 0,
  digital_out2 INTEGER DEFAULT 0,
  digital_out3 INTEGER DEFAULT 0,
  digital_out4 INTEGER DEFAULT 0,
  rtc_time DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_events (
  id TEXT PRIMARY KEY,
  device_id TEXT REFERENCES devices(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  triggered_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email_on_offline INTEGER DEFAULT 1,
  email_on_alert INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS database_snapshots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  snapshot_data TEXT NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS modbus_devices (
  id TEXT PRIMARY KEY,
  device_id TEXT REFERENCES devices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  manufacturer TEXT DEFAULT '',
  slave_id INTEGER DEFAULT 1,
  baud_rate INTEGER DEFAULT 9600,
  parity TEXT DEFAULT 'none',
  stop_bits INTEGER DEFAULT 1,
  data_bits INTEGER DEFAULT 8,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS modbus_registers (
  id TEXT PRIMARY KEY,
  modbus_device_id TEXT REFERENCES modbus_devices(id) ON DELETE CASCADE,
  address INTEGER NOT NULL,
  function_code INTEGER DEFAULT 3,
  label TEXT NOT NULL,
  data_type TEXT DEFAULT 'float32_be',
  scale REAL DEFAULT 1.0,
  unit TEXT DEFAULT '',
  group_name TEXT DEFAULT '',
  display_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(modbus_device_id, address, function_code)
);

CREATE TABLE IF NOT EXISTS modbus_readings (
  id TEXT PRIMARY KEY,
  modbus_device_id TEXT REFERENCES modbus_devices(id) ON DELETE CASCADE,
  register_id TEXT REFERENCES modbus_registers(id) ON DELETE CASCADE,
  raw_value TEXT DEFAULT '',
  scaled_value REAL DEFAULT 0.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

// ── CDN sql.js Loader ────────────────────────────────────────────────────────
let sqlPromise: Promise<any> | null = null;
function loadSqlJs() {
  if (sqlPromise) return sqlPromise;
  sqlPromise = new Promise((resolve, reject) => {
    const w = window as any;
    if (w.initSqlJs) {
      w.initSqlJs({ locateFile: (f: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${f}` })
        .then(resolve).catch(reject);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js";
    script.onload = () => {
      w.initSqlJs({ locateFile: (f: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${f}` })
        .then(resolve).catch(reject);
    };
    script.onerror = () => reject(new Error("Failed to load sql.js from CDN"));
    document.head.appendChild(script);
  });
  return sqlPromise;
}

// ── Database Manager Class ───────────────────────────────────────────────────
class LocalDatabaseManager {
  private dbInstance: any = null;
  private saveTimeout: any = null;
  private isLoaded = false;
  private initListeners: (() => void)[] = [];

  async init() {
    if (this.isLoaded) return;
    try {
      const SQL = await loadSqlJs();
      const saved = localStorage.getItem(DB_KEY);
      if (saved) {
        try {
          const binary = Uint8Array.from(atob(saved), (c) => c.charCodeAt(0));
          this.dbInstance = new SQL.Database(binary);
        } catch (e) {
          console.error("Load local DB error, starting fresh:", e);
          this.dbInstance = new SQL.Database();
        }
      } else {
        this.dbInstance = new SQL.Database();
      }

      this.dbInstance.run(SCHEMA);
      this.seedIfEmpty();
      this.isLoaded = true;

      // Notify any waiting queries
      this.initListeners.forEach((cb) => cb());
      this.initListeners = [];
      console.log("[localDb] Database successfully initialized.");
    } catch (err) {
      console.error("[localDb] Initialization failed:", err);
    }
  }

  onReady(callback: () => void) {
    if (this.isLoaded) callback();
    else this.initListeners.push(callback);
  }

  save() {
    if (!this.dbInstance) return;
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      try {
        const data = this.dbInstance.export();
        const b64 = btoa(String.fromCharCode(...data));
        localStorage.setItem(DB_KEY, b64);
        console.log("[localDb] Autosaved state to localStorage.");
      } catch (e) {
        console.error("Autosave local DB error:", e);
      }
    }, 300);
  }

  run(sql: string, params: any[] = []) {
    if (!this.dbInstance) throw new Error("Database not ready");
    this.dbInstance.run(sql, params);
    this.save();
  }

  query(sql: string, params: any[] = []): any[] {
    if (!this.dbInstance) return [];
    try {
      const stmt = this.dbInstance.prepare(sql);
      if (params.length) stmt.bind(params);
      const rows: any[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    } catch (e) {
      console.error(`Query failed: ${sql}`, e);
      return [];
    }
  }

  private seedIfEmpty() {
    const userCount = this.query("SELECT COUNT(*) as cnt FROM users")[0]?.cnt || 0;
    if (userCount > 0) return;

    console.log("[localDb] Database is empty. Seeding default accounts and devices...");

    // Seed Users
    // Admin ID: 'admin-uuid-1111'
    this.run(
      `INSERT INTO users (id, email, password) VALUES (?, ?, ?)`,
      ["admin-uuid-1111", "admin@bbjsense.com", "admin123"]
    );
    this.run(
      `INSERT INTO profiles (id, user_id, email, first_name, last_name, factory_name, location, subscription_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["prof-admin", "admin-uuid-1111", "admin@bbjsense.com", "System", "Admin", "BBJSENSE HQ", "San Francisco, USA", "active"]
    );
    this.run("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)", ["role-1", "admin-uuid-1111", "super_admin"]);
    this.run("INSERT INTO notification_preferences (id, user_id) VALUES (?, ?)", ["notif-1", "admin-uuid-1111"]);

    // Regular User ID: 'user-uuid-2222'
    this.run(
      `INSERT INTO users (id, email, password) VALUES (?, ?, ?)`,
      ["user-uuid-2222", "user@bbjsense.com", "user123"]
    );
    this.run(
      `INSERT INTO profiles (id, user_id, email, first_name, last_name, factory_name, location, subscription_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["prof-user", "user-uuid-2222", "user@bbjsense.com", "John", "Doe", "Doe Manufacturing", "Detroit, USA", "active"]
    );
    this.run("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)", ["role-2", "user-uuid-2222", "user"]);
    this.run("INSERT INTO notification_preferences (id, user_id) VALUES (?, ?)", ["notif-2", "user-uuid-2222"]);

    // Seed Devices
    const devices = [
      { id: "dev-uuid-1", mac: "00:1A:2B:3C:4D:5E", name: "IoT Controller Main", nick: "Assembly Line A Controller", owner: "user-uuid-2222", status: "approved", online: 1, modbus: "0x01" },
      { id: "dev-uuid-2", mac: "00:1A:2B:3C:4D:5F", name: "IoT Controller Auxiliary", nick: "Warehouse Fan Controller", owner: "user-uuid-2222", status: "approved", online: 0, modbus: "0x02" },
      { id: "dev-uuid-3", mac: "00:1A:2B:3C:4D:60", name: "IoT Temp Sensor", nick: "Chill Room Sensor", owner: "admin-uuid-1111", status: "approved", online: 1, modbus: "0x03" },
      { id: "dev-uuid-4", mac: "00:1A:2B:3C:4D:61", name: "New IoT Gateway", nick: "Storage Room Gateway", owner: "user-uuid-2222", status: "pending", online: 0, modbus: "0x04" }
    ];

    for (const d of devices) {
      this.run(
        `INSERT INTO devices (id, mac_address, name, nickname, owner_id, approval_status, is_online, modbus_address, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATETIME('now'))`,
        [d.id, d.mac, d.name, d.nick, d.owner, d.status, d.online, d.modbus]
      );

      // Seed channel configurations
      const channels = [
        { type: "analog", num: 1, label: "Pressure Sensor", mode: "4-20mA", unit: "bar", min: 0, max: 10 },
        { type: "analog", num: 2, label: "Flow Rate Sensor", mode: "0-10V", unit: "L/min", min: 0, max: 50 },
        { type: "analog", num: 3, label: "Humidity", mode: "0-10V", unit: "%RH", min: 0, max: 100 },
        { type: "analog", num: 4, label: "Voltage Input", mode: "0-10V", unit: "V", min: 0, max: 24 },
        { type: "digital_in", num: 1, label: "Door Switch A" },
        { type: "digital_in", num: 2, label: "E-Stop Safety Relay" },
        { type: "digital_in", num: 3, label: "Piston Limit Switch" },
        { type: "digital_in", num: 4, label: "Smoke Alarm Trigger" },
        { type: "digital_out", num: 1, label: "Solenoid Valve Relay" },
        { type: "digital_out", num: 2, label: "Warning Strobe Siren" },
        { type: "digital_out", num: 3, label: "Conveyor Belt Motor" },
        { type: "digital_out", num: 4, label: "Cooling Fan Switch" }
      ];

      for (const ch of channels) {
        this.run(
          `INSERT INTO device_channel_config (id, device_id, channel_type, channel_number, label, data_mode, unit, min_value, max_value)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [`ch-${d.id}-${ch.type}-${ch.num}`, d.id, ch.type, ch.num, ch.label, ch.mode || "0-10V", ch.unit || "", ch.min || 0, ch.max || 0]
        );
      }

      // Seed readings (last 6 hours, polled every 30 mins)
      if (d.online === 1) {
        const nowMs = Date.now();
        for (let i = 12; i >= 0; i--) {
          const timestamp = new Date(nowMs - i * 30 * 60 * 1000).toISOString();
          // Generate realistic values
          const val1 = 4.5 + Math.sin(i / 2) * 1.5 + Math.random() * 0.2;
          const val2 = 25 + Math.cos(i / 3) * 8 + Math.random() * 1.2;
          const val3 = 45 + Math.sin(i / 4) * 5 + Math.random() * 0.5;
          const val4 = 12.2 + Math.random() * 0.1;

          this.run(
            `INSERT INTO device_readings (id, device_id, analog_ch1, analog_ch2, analog_ch3, analog_ch4, digital_in1, digital_in2, digital_out1, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [`read-${d.id}-${i}`, d.id, val1, val2, val3, val4, i % 2, 0, (i + 1) % 2, timestamp]
          );
        }

        // Seed some system events
        this.run(
          `INSERT INTO device_events (id, device_id, event_type, message, triggered_by)
           VALUES (?, ?, ?, ?, ?)`,
          [`event-${d.id}-1`, d.id, "info", "Device initialized successfully", d.owner]
        );
        this.run(
          `INSERT INTO device_events (id, device_id, event_type, message, triggered_by)
           VALUES (?, ?, ?, ?, ?)`,
          [`event-${d.id}-2`, d.id, "control", "Solenoid Valve Relay turned ON by user", d.owner]
        );
      }
    }

    this.save();
  }
}

export const localDb = new LocalDatabaseManager();
localDb.init(); // Async startup

// ── Mock Auth Session ────────────────────────────────────────────────────────
export interface SessionUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  factory_name: string;
  location: string;
  subscription_status: string;
}

export const localAuth = {
  login: async (email: string, password: string): Promise<{ user: SessionUser | null; error: Error | null }> => {
    await new Promise(resolve => setTimeout(resolve, 300)); // Sim network latency
    const rows = localDb.query(
      `SELECT u.*, p.first_name, p.last_name, p.factory_name, p.location, p.subscription_status, r.role 
       FROM users u 
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN user_roles r ON r.user_id = u.id 
       WHERE u.email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return { user: null, error: new Error("No user found with this email.") };
    }

    const user = rows[0];
    if (user.password !== password) {
      return { user: null, error: new Error("Invalid password.") };
    }

    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      role: user.role || "user",
      factory_name: user.factory_name || "",
      location: user.location || "",
      subscription_status: user.subscription_status || "active"
    };

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
    return { user: sessionUser, error: null };
  },

  signUp: async (email: string, password: string, metadata: any): Promise<{ user: SessionUser | null; error: Error | null }> => {
    await new Promise(resolve => setTimeout(resolve, 300));

    const existing = localDb.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return { user: null, error: new Error("Email already registered.") };
    }

    const newId = `usr-${Math.random().toString(36).substring(2, 11)}`;
    const fName = metadata.first_name || "";
    const lName = metadata.last_name || "";
    const factory = metadata.factory_name || "";
    const loc = metadata.location || "";

    try {
      localDb.run(
        `INSERT INTO users (id, email, password) VALUES (?, ?, ?)`,
        [newId, email, password]
      );

      localDb.run(
        `INSERT INTO profiles (id, user_id, email, first_name, last_name, factory_name, location, subscription_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [`prof-${newId}`, newId, email, fName, lName, factory, loc, "active"]
      );

      localDb.run("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)", [`role-${newId}`, newId, "user"]);
      localDb.run("INSERT INTO notification_preferences (id, user_id) VALUES (?, ?)", [`notif-${newId}`, newId]);

      const sessionUser: SessionUser = {
        id: newId,
        email,
        first_name: fName,
        last_name: lName,
        role: "user",
        factory_name: factory,
        location: loc,
        subscription_status: "active"
      };

      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
      return { user: sessionUser, error: null };
    } catch (err: any) {
      return { user: null, error: err };
    }
  },

  signOut: async () => {
    sessionStorage.removeItem(SESSION_KEY);
  },

  getSession: (): SessionUser | null => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  }
};
