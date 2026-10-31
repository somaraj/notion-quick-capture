// src/main/drafts/draftStore.ts — Offline draft queue using sql.js (pure JS/WASM SQLite)
import initSqlJs, { type Database } from 'sql.js';
import path from 'path';
import { app } from 'electron';
import crypto from 'crypto';
import log from 'electron-log';
import fs from 'fs';
import type { CapturePayload, Draft } from '../../shared/types';

let db: Database | null = null;
let dbPath: string;

function ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// sql.js keeps the database in memory; persist it after every write.
// Write to a temp file and rename so a crash mid-write can't corrupt the queue.
function saveDbToFile(): void {
    if (!db) return;
    try {
        const tmpPath = `${dbPath}.tmp`;
        fs.writeFileSync(tmpPath, Buffer.from(db.export()));
        fs.renameSync(tmpPath, dbPath);
    } catch (error) {
        log.error('[drafts] Failed to save database:', error);
    }
}

export async function initDraftStore(): Promise<void> {
    const userDataPath = app.getPath('userData');
    const draftsDir = path.join(userDataPath, 'drafts');
    ensureDir(draftsDir);
    dbPath = path.join(draftsDir, 'drafts.db');

    const SQL = await initSqlJs();

    // Load existing database or create new
    if (fs.existsSync(dbPath)) {
        try {
            const fileBuffer = fs.readFileSync(dbPath);
            db = new SQL.Database(fileBuffer);
        } catch (error) {
            // Keep the unreadable file for manual recovery instead of overwriting it
            const backupPath = `${dbPath}.corrupt-${Date.now()}`;
            log.warn(`[drafts] Could not load existing database, moved to ${backupPath}:`, error);
            try {
                fs.renameSync(dbPath, backupPath);
            } catch {
                // ignore
            }
            db = new SQL.Database();
        }
    } else {
        db = new SQL.Database();
    }

    db.run(`
        CREATE TABLE IF NOT EXISTS drafts (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
            retry_count INTEGER NOT NULL DEFAULT 0,
            last_error TEXT
        )
    `);

    saveDbToFile();
    log.info('[drafts] Draft store initialized at:', dbPath);
}

export function saveDraft(payload: CapturePayload, error?: string): string {
    if (!db) throw new Error('Draft store not initialized');

    const id = crypto.randomUUID();
    const payloadJson = JSON.stringify(payload);

    db.run(
        'INSERT INTO drafts (id, payload, created_at, retry_count, last_error) VALUES (?, ?, ?, 0, ?)',
        [id, payloadJson, Date.now(), error ?? null],
    );
    saveDbToFile();

    log.info(`[drafts] Draft saved: ${id}`);
    return id;
}

export function listDrafts(): Draft[] {
    if (!db) return [];

    const stmt = db.prepare(
        'SELECT id, payload, created_at, retry_count, last_error FROM drafts ORDER BY created_at DESC',
    );
    const drafts: Draft[] = [];

    while (stmt.step()) {
        const row = stmt.getAsObject() as {
            id: string;
            payload: string;
            created_at: number;
            retry_count: number;
            last_error: string | null;
        };
        drafts.push({
            id: row.id,
            payload: JSON.parse(row.payload) as CapturePayload,
            createdAt: row.created_at,
            retryCount: row.retry_count,
            lastError: row.last_error ?? undefined,
        });
    }
    stmt.free();

    return drafts;
}

export function getDraft(id: string): Draft | null {
    if (!db) return null;

    const stmt = db.prepare(
        'SELECT id, payload, created_at, retry_count, last_error FROM drafts WHERE id = ?',
    );
    stmt.bind([id]);

    if (stmt.step()) {
        const row = stmt.getAsObject() as {
            id: string;
            payload: string;
            created_at: number;
            retry_count: number;
            last_error: string | null;
        };
        stmt.free();
        return {
            id: row.id,
            payload: JSON.parse(row.payload) as CapturePayload,
            createdAt: row.created_at,
            retryCount: row.retry_count,
            lastError: row.last_error ?? undefined,
        };
    }
    stmt.free();
    return null;
}

export function deleteDraft(id: string): void {
    if (!db) return;
    db.run('DELETE FROM drafts WHERE id = ?', [id]);
    saveDbToFile();
    log.info(`[drafts] Draft deleted: ${id}`);
}

export function incrementRetryCount(id: string, error: string): void {
    if (!db) return;
    db.run('UPDATE drafts SET retry_count = retry_count + 1, last_error = ? WHERE id = ?', [
        error,
        id,
    ]);
    saveDbToFile();
}

/** Record a transient failure (e.g. offline) without counting it toward the retry limit. */
export function setLastError(id: string, error: string): void {
    if (!db) return;
    db.run('UPDATE drafts SET last_error = ? WHERE id = ?', [error, id]);
    saveDbToFile();
}

export function getDraftCount(): number {
    if (!db) return 0;
    const stmt = db.prepare('SELECT COUNT(*) as count FROM drafts');
    stmt.step();
    const result = stmt.getAsObject() as { count: number };
    stmt.free();
    return result.count;
}

export const MAX_DRAFT_RETRIES = 5;

/** Drafts still eligible for automatic retry (or all drafts, for a manual retry). */
export function getPendingDrafts(includeExhausted = false): Draft[] {
    if (!db) return [];

    const stmt = db.prepare(
        'SELECT id, payload, created_at, retry_count, last_error FROM drafts WHERE retry_count < ? ORDER BY created_at ASC',
    );
    stmt.bind([includeExhausted ? Number.MAX_SAFE_INTEGER : MAX_DRAFT_RETRIES]);
    const drafts: Draft[] = [];

    while (stmt.step()) {
        const row = stmt.getAsObject() as {
            id: string;
            payload: string;
            created_at: number;
            retry_count: number;
            last_error: string | null;
        };
        drafts.push({
            id: row.id,
            payload: JSON.parse(row.payload) as CapturePayload,
            createdAt: row.created_at,
            retryCount: row.retry_count,
            lastError: row.last_error ?? undefined,
        });
    }
    stmt.free();

    return drafts;
}

export function deleteExhaustedDrafts(): number {
    if (!db) return 0;
    const before = getDraftCount();
    db.run('DELETE FROM drafts WHERE retry_count >= ?', [MAX_DRAFT_RETRIES]);
    saveDbToFile();
    return before - getDraftCount();
}

export function getExhaustedDraftCount(): number {
    if (!db) return 0;
    const stmt = db.prepare('SELECT COUNT(*) as count FROM drafts WHERE retry_count >= ?');
    stmt.bind([MAX_DRAFT_RETRIES]);
    stmt.step();
    const result = stmt.getAsObject() as { count: number };
    stmt.free();
    return result.count;
}

export function closeDraftStore(): void {
    if (db) {
        saveDbToFile();
        db.close();
        db = null;
        log.info('[drafts] Draft store closed');
    }
}
