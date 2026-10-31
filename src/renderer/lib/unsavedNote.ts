// src/renderer/lib/unsavedNote.ts — Keep the note being written across panel hides and app restarts
//
// Stored in the capture window's localStorage (inside the app's user-data folder). It is cleared as
// soon as the note is saved to Notion or discarded.
import type { DestinationRef, PropertyValue } from '../../shared/types';
import { isFilled } from './propertyValues';

const STORAGE_KEY = 'nqc.unsavedNote.v1';

export interface UnsavedNote {
    destination: DestinationRef | null;
    title: string;
    body: string;
    properties: Record<string, PropertyValue>;
    updatedAt: number;
}

/** True when the note contains anything worth keeping. */
export function hasContent(note: Pick<UnsavedNote, 'title' | 'body' | 'properties'>): boolean {
    return (
        note.title.trim().length > 0 ||
        note.body.trim().length > 0 ||
        Object.values(note.properties).some(isFilled)
    );
}

export function loadUnsavedNote(): UnsavedNote | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const note = JSON.parse(raw) as UnsavedNote;
        if (typeof note.title !== 'string' || typeof note.body !== 'string') return null;
        return { ...note, properties: note.properties ?? {} };
    } catch {
        return null;
    }
}

export function saveUnsavedNote(note: Omit<UnsavedNote, 'updatedAt'>): void {
    try {
        if (hasContent(note)) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...note, updatedAt: Date.now() }));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    } catch {
        // Storage unavailable or full — the note still lives in memory while the app runs
    }
}

export function clearUnsavedNote(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // ignore
    }
}
