// src/renderer/lib/recentDestinations.ts — Most recently used capture destinations
import type { DestinationRef } from '../../shared/types';

export const MAX_RECENT_DESTINATIONS = 5;

/** Put `dest` first, drop duplicates and keep the list short. */
export function addRecent(list: DestinationRef[], dest: DestinationRef): DestinationRef[] {
    const entry: DestinationRef = { id: dest.id, type: dest.type, title: dest.title };
    if (dest.icon) entry.icon = dest.icon;
    return [entry, ...list.filter((d) => d.id !== dest.id)].slice(0, MAX_RECENT_DESTINATIONS);
}

export async function getRecentDestinations(): Promise<DestinationRef[]> {
    try {
        return (await window.notionBridge.config.get('recentDestinations')) ?? [];
    } catch {
        return [];
    }
}

export async function rememberDestination(dest: DestinationRef): Promise<void> {
    try {
        const updated = addRecent(await getRecentDestinations(), dest);
        await window.notionBridge.config.set('recentDestinations', updated);
    } catch {
        // Recents are a convenience; never block a capture on them
    }
}
