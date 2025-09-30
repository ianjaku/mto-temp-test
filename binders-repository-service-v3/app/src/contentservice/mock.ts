/* eslint-disable sort-imports */
import {
    buildPromptOptimizeBinderContent,
    buildPromptOptimizeChunkContent,
} from "./internal/prompts";
import { ILlmService } from "./internal/llm";
import { IFeatureFlagService } from "@binders/binders-service-common/lib/launchdarkly/server";
import { LDFlags } from "@binders/client/lib/launchdarkly";

export const MOCKED_OPTIMIZE_BINDER_RESPONSE: (callNo: string) => string =
    callNo => `
<manual>
<title>Optimized Title [callNo:${callNo}]</title>
<chunks>
<chunk>This is <strong>mocked</strong> chunk [callNo:${callNo}]</chunk>
<chunk><ul><li>Mocked</li><li>List</li><li>Call: [callNo:${callNo}]</li></ul></chunk>
</chunks>
</manual>
`

export const MOCKED_OPTIMIZE_CHUNK_RESPONSE: (callNo: string) => string =
    callNo => `This is a **mocked** response [callNo:${callNo}].`

export class MockLlmService implements ILlmService {
    constructor(private readonly reply: (req: string) => string[]) { }
    optimizeContent(req: string): Promise<string[]> {
        return Promise.resolve(this.reply(req));
    }
}

const callNoRegex = /\[callNo:([0-9]+?)\]/g;
export class AutoMockLlmService implements ILlmService {
    async optimizeContent(req: string): Promise<string[]> {
        const chunkPromptPrefix = buildPromptOptimizeChunkContent("").slice(0, 200);
        const binderPromptPrefix = buildPromptOptimizeBinderContent("").slice(0, 200);
        const callNoMatches = [...req.matchAll(callNoRegex)]
            .map(match => match.at(1))
            .filter(Boolean);
        const callNo = callNoMatches.length ? String(parseInt(callNoMatches.at(0)) + 1) : "1";
        if (req.startsWith(chunkPromptPrefix)) {
            return [MOCKED_OPTIMIZE_CHUNK_RESPONSE(callNo)];
        }
        if (req.startsWith(binderPromptPrefix)) {
            return [MOCKED_OPTIMIZE_BINDER_RESPONSE(callNo)];
        }
        return [];
    }
}

export class MockFeatureFlagService implements IFeatureFlagService {
    async getFlag<T>(flagKey: LDFlags, _context?: { userId?: string; accountId?: string }): Promise<T> {
        if (flagKey === LDFlags.MANUAL_FROM_VIDEO) {
            return true as unknown as T;
        }
        return false as unknown as T;
    }

    async getAllFlags(_context?: { userId?: string; accountId?: string }): Promise<unknown> {
        return {
            [LDFlags.MANUAL_FROM_VIDEO]: true
        };
    }
}

