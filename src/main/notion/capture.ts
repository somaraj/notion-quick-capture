// src/main/notion/capture.ts — Create page (with body blocks) in Notion
import log from 'electron-log';
import { getNotionClient, notionRequest } from './client';
import { buildProperties } from './properties';
import { isRetryableError, toErrorMessage } from './errors';
import { markdownToBlocks, type NotionBlock } from '../../shared/markdownToBlocks';
import type { CapturePayload, CaptureResult } from '../../shared/types';

// Notion API limits block children to 100 per request
const MAX_BLOCKS_PER_REQUEST = 100;

type CreatePageArgs = Parameters<Awaited<ReturnType<typeof getNotionClient>>['pages']['create']>[0];
type AppendChildren = Parameters<
    Awaited<ReturnType<typeof getNotionClient>>['blocks']['children']['append']
>[0]['children'];

export interface CaptureOutcome extends CaptureResult {
    /** True when the failure is transient and the capture should be queued for retry. */
    retryable?: boolean;
}

export async function captureToNotion(payload: CapturePayload): Promise<CaptureOutcome> {
    try {
        const client = await getNotionClient();
        const properties = buildProperties(payload.properties, payload.title);
        const blocks: NotionBlock[] = payload.body.trim() ? markdownToBlocks(payload.body) : [];

        log.info(`[capture] Creating page in ${payload.destinationType}: ${payload.destinationId}`);

        const parent =
            payload.destinationType === 'database'
                ? { database_id: payload.destinationId }
                : { page_id: payload.destinationId };

        // Send the first batch of blocks with the create call so a single request
        // produces a complete page in the common case (avoids half-written pages on retry).
        const page = (await notionRequest(() =>
            client.pages.create({
                parent,
                properties: properties as CreatePageArgs['properties'],
                children: blocks.slice(0, MAX_BLOCKS_PER_REQUEST) as CreatePageArgs['children'],
            } as CreatePageArgs),
        )) as unknown as { id: string; url: string };

        for (let i = MAX_BLOCKS_PER_REQUEST; i < blocks.length; i += MAX_BLOCKS_PER_REQUEST) {
            const chunk = blocks.slice(i, i + MAX_BLOCKS_PER_REQUEST);
            try {
                await notionRequest(() =>
                    client.blocks.children.append({
                        block_id: page.id,
                        children: chunk as AppendChildren,
                    }),
                );
            } catch (error) {
                // The page exists, so don't queue a retry (it would create a duplicate page)
                log.error('[capture] Page created but appending remaining blocks failed:', error);
                return {
                    status: 'error',
                    pageId: page.id,
                    pageUrl: page.url,
                    error: `Page created, but part of the note could not be added: ${toErrorMessage(error)}`,
                };
            }
        }

        log.info(`[capture] Page created successfully: ${page.id}`);

        return {
            status: 'success',
            pageId: page.id,
            pageUrl: page.url,
        };
    } catch (error) {
        const message = toErrorMessage(error);
        const retryable = isRetryableError(error);
        log.error(`[capture] Failed to capture (retryable=${retryable}):`, message);

        return {
            status: 'error',
            error: message,
            retryable,
        };
    }
}
