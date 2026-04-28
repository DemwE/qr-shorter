import { Redis } from "@upstash/redis";
import Database from "better-sqlite3";
import { customAlphabet } from "nanoid";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type LinkRecord = {
  code: string;
  publicId: string;
  url: string;
  createdAt: string;
  lastAccessedAt: string | null;
  totalClicks: number;
  qrScans: number;
};

type LinkEvent = {
  type: "redirect" | "qr_scan";
  createdAt: string;
  ip?: string | null;
  userAgent?: string | null;
  referer?: string | null;
};

type LinkStats = LinkRecord & {
  recentEvents: LinkEvent[];
};

interface StorageEngine {
  createShortLink(url: string): Promise<LinkRecord>;
  getByCode(code: string): Promise<LinkRecord | null>;
  getByPublicId(publicId: string): Promise<LinkRecord | null>;
  recordRedirect(code: string, event: Omit<LinkEvent, "createdAt">): Promise<void>;
  getStats(code: string): Promise<LinkStats | null>;
  getStatsByPublicId(publicId: string): Promise<LinkStats | null>;
}

const createCode = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  7,
);

function normalizeRow(row: {
  code: string;
  public_id: string;
  url: string;
  created_at: string;
  last_accessed_at: string | null;
  total_clicks: number;
  qr_scans: number;
}): LinkRecord {
  return {
    code: row.code,
    publicId: row.public_id,
    url: row.url,
    createdAt: row.created_at,
    lastAccessedAt: row.last_accessed_at,
    totalClicks: Number(row.total_clicks ?? 0),
    qrScans: Number(row.qr_scans ?? 0),
  };
}

class SqliteStorage implements StorageEngine {
  private db: Database.Database;

  constructor() {
    const sqlitePath =
      process.env.SQLITE_PATH ??
      (process.env.VERCEL
        ? "/tmp/qr-shorter.db"
        : path.join(process.cwd(), "data", "qr-shorter.db"));
    fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
    this.db = new Database(sqlitePath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS links (
        code TEXT PRIMARY KEY,
        public_id TEXT UNIQUE,
        url TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_accessed_at TEXT,
        total_clicks INTEGER NOT NULL DEFAULT 0,
        qr_scans INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        ip TEXT,
        user_agent TEXT,
        referer TEXT,
        FOREIGN KEY(code) REFERENCES links(code)
      );

      CREATE INDEX IF NOT EXISTS idx_events_code_created ON events (code, created_at DESC);
    `);

    const columns = this.db
      .prepare("PRAGMA table_info(links)")
      .all() as { name: string }[];
    const hasPublicId = columns.some((column) => column.name === "public_id");
    if (!hasPublicId) {
      this.db.exec("ALTER TABLE links ADD COLUMN public_id TEXT");
    }

    this.db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_links_public_id ON links (public_id)");

    const linksMissingPublicId = this.db
      .prepare("SELECT code FROM links WHERE public_id IS NULL OR public_id = ''")
      .all() as { code: string }[];
    if (linksMissingPublicId.length > 0) {
      const updatePublicId = this.db.prepare("UPDATE links SET public_id = ? WHERE code = ?");
      const tx = this.db.transaction((rows: { code: string }[]) => {
        for (const row of rows) {
          updatePublicId.run(randomUUID(), row.code);
        }
      });
      tx(linksMissingPublicId);
    }
  }

  async createShortLink(url: string): Promise<LinkRecord> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = createCode();
      const publicId = randomUUID();
      const now = new Date().toISOString();
      try {
        this.db
          .prepare(
            "INSERT INTO links (code, public_id, url, created_at, total_clicks, qr_scans) VALUES (?, ?, ?, ?, 0, 0)",
          )
          .run(code, publicId, url, now);
        const row = this.db
          .prepare(
            "SELECT code, public_id, url, created_at, last_accessed_at, total_clicks, qr_scans FROM links WHERE code = ?",
          )
          .get(code) as {
          code: string;
          public_id: string;
          url: string;
          created_at: string;
          last_accessed_at: string | null;
          total_clicks: number;
          qr_scans: number;
        };
        return normalizeRow(row);
      } catch {
        continue;
      }
    }
    throw new Error("Unable to generate unique short code.");
  }

  async getByCode(code: string): Promise<LinkRecord | null> {
    const row = this.db
      .prepare(
        "SELECT code, public_id, url, created_at, last_accessed_at, total_clicks, qr_scans FROM links WHERE code = ?",
      )
      .get(code) as
      | {
          code: string;
          public_id: string;
          url: string;
          created_at: string;
          last_accessed_at: string | null;
          total_clicks: number;
          qr_scans: number;
        }
      | undefined;
    if (!row) {
      return null;
    }
    return normalizeRow(row);
  }

  async getByPublicId(publicId: string): Promise<LinkRecord | null> {
    const row = this.db
      .prepare(
        "SELECT code, public_id, url, created_at, last_accessed_at, total_clicks, qr_scans FROM links WHERE public_id = ?",
      )
      .get(publicId) as
      | {
          code: string;
          public_id: string;
          url: string;
          created_at: string;
          last_accessed_at: string | null;
          total_clicks: number;
          qr_scans: number;
        }
      | undefined;
    if (!row) {
      return null;
    }
    return normalizeRow(row);
  }

  async recordRedirect(code: string, event: Omit<LinkEvent, "createdAt">): Promise<void> {
    const now = new Date().toISOString();
    const isQr = event.type === "qr_scan";
    this.db
      .prepare(
        "UPDATE links SET total_clicks = total_clicks + 1, qr_scans = qr_scans + ?, last_accessed_at = ? WHERE code = ?",
      )
      .run(isQr ? 1 : 0, now, code);
    this.db
      .prepare(
        "INSERT INTO events (code, type, created_at, ip, user_agent, referer) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(code, event.type, now, event.ip ?? null, event.userAgent ?? null, event.referer ?? null);
  }

  async getStats(code: string): Promise<LinkStats | null> {
    const link = await this.getByCode(code);
    if (!link) {
      return null;
    }

    const recentEvents = this.db
      .prepare(
        "SELECT type, created_at, ip, user_agent, referer FROM events WHERE code = ? ORDER BY created_at DESC LIMIT 20",
      )
      .all(code) as {
      type: "redirect" | "qr_scan";
      created_at: string;
      ip: string | null;
      user_agent: string | null;
      referer: string | null;
    }[];

    return {
      ...link,
      recentEvents: recentEvents.map((evt) => ({
        type: evt.type,
        createdAt: evt.created_at,
        ip: evt.ip,
        userAgent: evt.user_agent,
        referer: evt.referer,
      })),
    };
  }

  async getStatsByPublicId(publicId: string): Promise<LinkStats | null> {
    const link = await this.getByPublicId(publicId);
    if (!link) {
      return null;
    }
    return this.getStats(link.code);
  }
}

class RedisStorage implements StorageEngine {
  private redis: Redis;

  constructor() {
    this.redis = Redis.fromEnv();
  }

  private linkKey(code: string): string {
    return `qr:link:${code}`;
  }

  private eventsKey(code: string): string {
    return `qr:events:${code}`;
  }

  private publicIdKey(publicId: string): string {
    return `qr:public:${publicId}`;
  }

  async createShortLink(url: string): Promise<LinkRecord> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = createCode();
      const publicId = randomUUID();
      const key = this.linkKey(code);
      const exists = await this.redis.exists(key);
      if (exists) {
        continue;
      }
      const now = new Date().toISOString();
      await this.redis.hset(key, {
        code,
        publicId,
        url,
        createdAt: now,
        lastAccessedAt: "",
        totalClicks: "0",
        qrScans: "0",
      });
      await this.redis.set(this.publicIdKey(publicId), code);
      return {
        code,
        publicId,
        url,
        createdAt: now,
        lastAccessedAt: null,
        totalClicks: 0,
        qrScans: 0,
      };
    }
    throw new Error("Unable to generate unique short code.");
  }

  async getByCode(code: string): Promise<LinkRecord | null> {
    const row = await this.redis.hgetall<Record<string, string>>(this.linkKey(code));
    if (!row || !row.url) {
      return null;
    }

    const publicId = row.publicId && row.publicId.length > 0 ? row.publicId : randomUUID();
    if (!row.publicId || row.publicId.length === 0) {
      await this.redis.hset(this.linkKey(code), { publicId });
    }
    await this.redis.set(this.publicIdKey(publicId), code);

    return {
      code,
      publicId,
      url: row.url,
      createdAt: row.createdAt,
      lastAccessedAt: row.lastAccessedAt || null,
      totalClicks: Number(row.totalClicks ?? 0),
      qrScans: Number(row.qrScans ?? 0),
    };
  }

  async getByPublicId(publicId: string): Promise<LinkRecord | null> {
    const code = await this.redis.get<string>(this.publicIdKey(publicId));
    if (!code) {
      return null;
    }
    return this.getByCode(code);
  }

  async recordRedirect(code: string, event: Omit<LinkEvent, "createdAt">): Promise<void> {
    const now = new Date().toISOString();
    const linkKey = this.linkKey(code);
    await this.redis.hincrby(linkKey, "totalClicks", 1);
    if (event.type === "qr_scan") {
      await this.redis.hincrby(linkKey, "qrScans", 1);
    }
    await this.redis.hset(linkKey, { lastAccessedAt: now });

    const payload = JSON.stringify({
      type: event.type,
      createdAt: now,
      ip: event.ip ?? null,
      userAgent: event.userAgent ?? null,
      referer: event.referer ?? null,
    } satisfies LinkEvent);
    const eventsKey = this.eventsKey(code);
    await this.redis.lpush(eventsKey, payload);
    await this.redis.ltrim(eventsKey, 0, 19);
  }

  async getStats(code: string): Promise<LinkStats | null> {
    const link = await this.getByCode(code);
    if (!link) {
      return null;
    }
    const rawEvents = await this.redis.lrange<string>(this.eventsKey(code), 0, 19);
    return {
      ...link,
      recentEvents: rawEvents
        .map((item) => {
          try {
            return JSON.parse(item) as LinkEvent;
          } catch {
            return null;
          }
        })
        .filter((item): item is LinkEvent => item !== null),
    };
  }

  async getStatsByPublicId(publicId: string): Promise<LinkStats | null> {
    const link = await this.getByPublicId(publicId);
    if (!link) {
      return null;
    }
    return this.getStats(link.code);
  }
}

const storage: StorageEngine =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new RedisStorage()
    : new SqliteStorage();

export { storage };
export type { LinkRecord, LinkStats };
