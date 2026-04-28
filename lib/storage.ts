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

type HistoryRecord = {
  publicId: string;
  code: string;
  url: string;
  createdAt: string;
  lastAccessedAt: string | null;
  totalClicks: number;
  qrScans: number;
};

interface StorageEngine {
  createShortLink(url: string): Promise<LinkRecord>;
  getByCode(code: string): Promise<LinkRecord | null>;
  getByPublicId(publicId: string): Promise<LinkRecord | null>;
  recordRedirect(code: string, event: Omit<LinkEvent, "createdAt">): Promise<void>;
  getStats(code: string): Promise<LinkStats | null>;
  getStatsByPublicId(publicId: string): Promise<LinkStats | null>;
  listHistory(limit: number): Promise<HistoryRecord[]>;
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

      CREATE TABLE IF NOT EXISTS link_public_ids (
        public_id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(code) REFERENCES links(code)
      );

      CREATE INDEX IF NOT EXISTS idx_link_public_ids_code ON link_public_ids (code);
      CREATE INDEX IF NOT EXISTS idx_link_public_ids_created ON link_public_ids (created_at DESC);
    `);

    const columns = this.db
      .prepare("PRAGMA table_info(links)")
      .all() as { name: string }[];
    const hasPublicId = columns.some((column) => column.name === "public_id");
    if (!hasPublicId) {
      this.db.exec("ALTER TABLE links ADD COLUMN public_id TEXT");
    }

    this.db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_links_public_id ON links (public_id)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_links_url ON links (url)");

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

    this.db.exec(`
      INSERT OR IGNORE INTO link_public_ids (public_id, code, created_at)
      SELECT public_id, code, created_at
      FROM links
      WHERE public_id IS NOT NULL AND public_id != ''
    `);
  }

  async createShortLink(url: string): Promise<LinkRecord> {
    const now = new Date().toISOString();
    const publicId = randomUUID();

    const existing = this.db
      .prepare(
        "SELECT code, public_id, url, created_at, last_accessed_at, total_clicks, qr_scans FROM links WHERE url = ? ORDER BY created_at ASC LIMIT 1",
      )
      .get(url) as
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

    let row = existing;
    if (!row) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = createCode();
        const canonicalPublicId = randomUUID();
        try {
          this.db
            .prepare(
              "INSERT INTO links (code, public_id, url, created_at, total_clicks, qr_scans) VALUES (?, ?, ?, ?, 0, 0)",
            )
            .run(code, canonicalPublicId, url, now);
          row = this.db
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
          break;
        } catch {
          continue;
        }
      }
    }

    if (!row) {
      throw new Error("Unable to generate unique short code.");
    }

    this.db
      .prepare("INSERT INTO link_public_ids (public_id, code, created_at) VALUES (?, ?, ?)")
      .run(publicId, row.code, now);

    const normalized = normalizeRow(row);
    return {
      ...normalized,
      publicId,
      createdAt: now,
    };
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
    const mapping = this.db
      .prepare("SELECT code, created_at FROM link_public_ids WHERE public_id = ?")
      .get(publicId) as { code: string; created_at: string } | undefined;
    if (mapping) {
      const link = await this.getByCode(mapping.code);
      if (!link) {
        return null;
      }
      return {
        ...link,
        publicId,
        createdAt: mapping.created_at,
      };
    }

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
    const stats = await this.getStats(link.code);
    if (!stats) {
      return null;
    }
    return {
      ...stats,
      publicId,
      createdAt: link.createdAt,
    };
  }

  async listHistory(limit: number): Promise<HistoryRecord[]> {
    const rows = this.db
      .prepare(
        `
          SELECT
            h.public_id,
            h.code,
            l.url,
            h.created_at,
            l.last_accessed_at,
            l.total_clicks,
            l.qr_scans
          FROM link_public_ids h
          INNER JOIN links l ON l.code = h.code
          ORDER BY h.created_at DESC
          LIMIT ?
        `,
      )
      .all(Math.max(1, Math.min(limit, 200))) as {
      public_id: string;
      code: string;
      url: string;
      created_at: string;
      last_accessed_at: string | null;
      total_clicks: number;
      qr_scans: number;
    }[];

    return rows.map((row) => ({
      publicId: row.public_id,
      code: row.code,
      url: row.url,
      createdAt: row.created_at,
      lastAccessedAt: row.last_accessed_at,
      totalClicks: Number(row.total_clicks ?? 0),
      qrScans: Number(row.qr_scans ?? 0),
    }));
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

  private publicMetaKey(publicId: string): string {
    return `qr:public-meta:${publicId}`;
  }

  private urlKey(url: string): string {
    const encoded = Buffer.from(url).toString("base64url");
    return `qr:url:${encoded}`;
  }

  private historyKey(): string {
    return "qr:history";
  }

  async createShortLink(url: string): Promise<LinkRecord> {
    const now = new Date().toISOString();
    const publicId = randomUUID();

    let code = await this.redis.get<string>(this.urlKey(url));
    if (!code) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const candidate = createCode();
        const key = this.linkKey(candidate);
        const exists = await this.redis.exists(key);
        if (exists) {
          continue;
        }

        await this.redis.hset(key, {
          code: candidate,
          publicId: randomUUID(),
          url,
          createdAt: now,
          lastAccessedAt: "",
          totalClicks: "0",
          qrScans: "0",
        });
        await this.redis.set(this.urlKey(url), candidate);
        code = candidate;
        break;
      }
    }

    if (!code) {
      throw new Error("Unable to generate unique short code.");
    }

    await this.redis.set(this.publicIdKey(publicId), code);
    await this.redis.set(this.publicMetaKey(publicId), now);
    await this.redis.lpush(this.historyKey(), publicId);
    await this.redis.ltrim(this.historyKey(), 0, 499);

    const link = await this.getByCode(code);
    if (!link) {
      throw new Error("Unable to load created link.");
    }

    return {
      ...link,
      publicId,
      createdAt: now,
    };
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
    const link = await this.getByCode(code);
    if (!link) {
      return null;
    }
    const createdAt = await this.redis.get<string>(this.publicMetaKey(publicId));
    return {
      ...link,
      publicId,
      createdAt: createdAt ?? link.createdAt,
    };
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
    const stats = await this.getStats(link.code);
    if (!stats) {
      return null;
    }
    return {
      ...stats,
      publicId,
      createdAt: link.createdAt,
    };
  }

  async listHistory(limit: number): Promise<HistoryRecord[]> {
    const boundedLimit = Math.max(1, Math.min(limit, 200));
    const publicIds = await this.redis.lrange<string>(this.historyKey(), 0, boundedLimit - 1);
    const records = await Promise.all(publicIds.map((publicId) => this.getByPublicId(publicId)));

    return records
      .filter((record): record is LinkRecord => record !== null)
      .map((record) => ({
        publicId: record.publicId,
        code: record.code,
        url: record.url,
        createdAt: record.createdAt,
        lastAccessedAt: record.lastAccessedAt,
        totalClicks: record.totalClicks,
        qrScans: record.qrScans,
      }));
  }
}

const storage: StorageEngine =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new RedisStorage()
    : new SqliteStorage();

export { storage };
export type { HistoryRecord, LinkRecord, LinkStats };
