/**
 * client.ts
 * Mock Supabase Client.
 * Redirects all queries and authentication calls directly to the local browser-side SQLite database.
 */

import { localDb, localAuth, type SessionUser } from "@/lib/localDb";

// ── Mock Auth System ─────────────────────────────────────────────────────────
class MockAuth {
  private listeners: ((event: string, session: any) => void)[] = [];

  constructor() {
    // Poll session changes slightly to trigger listeners
    setInterval(() => {
      const user = localAuth.getSession();
      if (user) {
        this.trigger("SIGNED_IN", { user });
      }
    }, 1000);
  }

  async signInWithPassword({ email, password }: any) {
    const { user, error } = await localAuth.login(email, password);
    if (user) {
      this.trigger("SIGNED_IN", { user });
    }
    return { data: { user, session: user ? { user } : null }, error };
  }

  async signUp({ email, password, options }: any) {
    const meta = options?.data || {};
    const { user, error } = await localAuth.signUp(email, password, meta);
    if (user) {
      this.trigger("SIGNED_IN", { user });
    }
    return { data: { user, session: user ? { user } : null }, error };
  }

  async signOut() {
    await localAuth.signOut();
    this.trigger("SIGNED_OUT", null);
    return { error: null };
  }

  async getSession() {
    const user = localAuth.getSession();
    return { data: { session: user ? { user } : null }, error: null };
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    this.listeners.push(callback);
    const user = localAuth.getSession();
    callback(user ? "SIGNED_IN" : "SIGNED_OUT", user ? { user } : null);

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners = this.listeners.filter((l) => l !== callback);
          }
        }
      }
    };
  }

  private trigger(event: string, session: any) {
    this.listeners.forEach((l) => l(event, session));
  }
}

// ── Mock Query Builder ───────────────────────────────────────────────────────
class MockQueryBuilder {
  private table: string;
  private isSelect = false;
  private selectCols = "*";
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
    this.selectCols = cols;
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

  private async execute(): Promise<{ data: any; error: any }> {
    return new Promise((resolve) => {
      localDb.onReady(() => {
        try {
          if (this.isSelect) {
            resolve(this.executeSelect());
          } else if (this.isInsert) {
            resolve(this.executeInsert());
          } else if (this.isUpdate) {
            resolve(this.executeUpdate());
          } else if (this.isDelete) {
            resolve(this.executeDelete());
          } else if (this.isUpsert) {
            resolve(this.executeUpsert());
          } else {
            resolve({ data: null, error: new Error("Invalid query action") });
          }
        } catch (err: any) {
          resolve({ data: null, error: err });
        }
      });
    });
  }

  private executeSelect() {
    let sql = `SELECT * FROM ${this.table}`;
    const params: any[] = [];

    if (this.filters.length > 0) {
      const parts = this.filters.map((f) => {
        params.push(f.val);
        return `${f.col} ${f.op} ?`;
      });
      sql += ` WHERE ${parts.join(" AND ")}`;
    }

    if (this.orderCol) {
      sql += ` ORDER BY ${this.orderCol} ${this.orderAsc ? "ASC" : "DESC"}`;
    }

    if (this.limitCount !== null) {
      sql += ` LIMIT ${this.limitCount}`;
    }

    const rows = localDb.query(sql, params);

    // Emulate boolean conversions if types need adjusting
    const parsedRows = rows.map((row) => {
      const copy = { ...row };
      // SQLite stores boolean as 1/0, convert back to boolean for devices and readings
      if (this.table === "devices") {
        if (copy.is_online !== undefined) copy.is_online = copy.is_online === 1;
      }
      if (this.table === "device_readings") {
        ["digital_in1", "digital_in2", "digital_in3", "digital_in4", "digital_out1", "digital_out2", "digital_out3", "digital_out4"].forEach((k) => {
          if (copy[k] !== undefined && copy[k] !== null) copy[k] = copy[k] === 1;
        });
      }
      return copy;
    });

    if (this.expectSingle) {
      return { data: parsedRows[0] || null, error: null };
    }
    return { data: parsedRows, error: null };
  }

  private executeInsert() {
    const dataArray = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
    const results: any[] = [];

    for (const item of dataArray) {
      const keys = Object.keys(item);
      const vals = Object.values(item).map((val) => {
        if (typeof val === "boolean") return val ? 1 : 0;
        return val;
      });

      // Generate id if missing
      let itemId = item.id;
      if (!itemId) {
        itemId = `${this.table.substring(0, 3)}-${Math.random().toString(36).substring(2, 11)}`;
        const idIdx = keys.indexOf("id");
        if (idIdx === -1) {
          keys.push("id");
          vals.push(itemId);
        } else {
          vals[idIdx] = itemId;
        }
      }

      const placeholders = keys.map(() => "?").join(", ");
      const sql = `INSERT INTO ${this.table} (${keys.join(", ")}) VALUES (${placeholders})`;

      localDb.run(sql, vals);
      results.push({ ...item, id: itemId });
    }

    return { data: Array.isArray(this.insertData) ? results : results[0], error: null };
  }

  private executeUpdate() {
    const keys = Object.keys(this.updateData);
    const vals = Object.values(this.updateData).map((val) => {
      if (typeof val === "boolean") return val ? 1 : 0;
      return val;
    });

    let sql = `UPDATE ${this.table} SET ` + keys.map((k) => `${k} = ?`).join(", ");
    const filterParams: any[] = [];

    if (this.filters.length > 0) {
      const parts = this.filters.map((f) => {
        filterParams.push(f.val);
        return `${f.col} ${f.op} ?`;
      });
      sql += ` WHERE ${parts.join(" AND ")}`;
    }

    localDb.run(sql, [...vals, ...filterParams]);
    return { data: this.updateData, error: null };
  }

  private executeDelete() {
    let sql = `DELETE FROM ${this.table}`;
    const params: any[] = [];

    if (this.filters.length > 0) {
      const parts = this.filters.map((f) => {
        params.push(f.val);
        return `${f.col} ${f.op} ?`;
      });
      sql += ` WHERE ${parts.join(" AND ")}`;
    }

    localDb.run(sql, params);
    return { data: null, error: null };
  }

  private executeUpsert() {
    const dataArray = Array.isArray(this.upsertData) ? this.upsertData : [this.upsertData];
    const results: any[] = [];

    for (const item of dataArray) {
      const keys = Object.keys(item);
      const vals = Object.values(item).map((val) => {
        if (typeof val === "boolean") return val ? 1 : 0;
        return val;
      });

      // Simple SQLite upsert using INSERT OR REPLACE
      const placeholders = keys.map(() => "?").join(", ");
      const sql = `INSERT OR REPLACE INTO ${this.table} (${keys.join(", ")}) VALUES (${placeholders})`;

      localDb.run(sql, vals);
      results.push(item);
    }

    return { data: Array.isArray(this.upsertData) ? results : results[0], error: null };
  }
}

// ── Mock Realtime Channel ────────────────────────────────────────────────────
class MockChannel {
  on(event: string, filter: any, callback: () => void) {
    return this;
  }
  subscribe() {
    return this;
  }
}

// ── Supabase Client Mock Singleton ───────────────────────────────────────────
class SupabaseMockClient {
  auth = new MockAuth();

  from(table: string) {
    return new MockQueryBuilder(table);
  }

  channel(name: string) {
    return new MockChannel();
  }

  removeChannel(chan: any) {
    // No-op
  }
}

export const supabase: any = new SupabaseMockClient();