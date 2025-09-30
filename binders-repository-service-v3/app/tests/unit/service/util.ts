import { DocumentAncestors, ReaderFeedbackConfig } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { resolveReaderFeedbackConfigForItem } from "../../../src/repositoryservice/readerfeedback/resolve";

const ITEM_ID = "item-id";
const LVL_1_PARENT_1_ID = "lvl-1-parent-1-id";
const LVL_1_PARENT_2_ID = "lvl-1-parent-2-id";
const LVL_2_PARENT_1_ID = "lvl-2-parent-1-id";
const LVL_3_PARENT_1_ID = "lvl-3-parent-1-id";

describe("resolveReaderFeedbackConfigForItem", () => {
    it("returns the item config when the item has one defined", () => {

        const ancestors: DocumentAncestors = {
            [ITEM_ID]: [LVL_1_PARENT_1_ID]
        };
        const configs:  Record<string, ReaderFeedbackConfig> = {
            [ITEM_ID]: {
                readerCommentsEnabled: true,
                readerRatingEnabled: null,
                readConfirmationEnabled: null,
            },
            [LVL_1_PARENT_1_ID]: {  // should not be used
                readerCommentsEnabled: false,
                readerRatingEnabled: false,
                readConfirmationEnabled: null,
            }
        };
        const resolvedConfig = resolveReaderFeedbackConfigForItem(ITEM_ID, ancestors, configs);
        expect(resolvedConfig).toEqual({
            readerCommentsEnabled: true,
            readerRatingEnabled: true,
            readConfirmationEnabled: false,
        });
    });

    it("returns the parent item config when the item does not have one defined", () => {
        const ancestors: DocumentAncestors = {
            [ITEM_ID]: [LVL_1_PARENT_1_ID]
        };
        const configs: Record<string, ReaderFeedbackConfig> = {
            [LVL_1_PARENT_1_ID]: {
                readerCommentsEnabled: null,
                readerRatingEnabled: false,
                readConfirmationEnabled: null,
            }
        };
        const resolvedConfig = resolveReaderFeedbackConfigForItem(ITEM_ID, ancestors, configs);
        expect(resolvedConfig).toEqual({
            readerCommentsEnabled: true,
            readerRatingEnabled: false,
            readConfirmationEnabled: false,
        });
    });

    it("returns inherited ancestor config many levels up", () => {
        const ancestors: DocumentAncestors = {
            [ITEM_ID]: [LVL_1_PARENT_1_ID],
            [LVL_1_PARENT_1_ID]: [LVL_2_PARENT_1_ID],
            [LVL_2_PARENT_1_ID]: [LVL_3_PARENT_1_ID],
        };
        const configs:  Record<string, ReaderFeedbackConfig> = {
            [LVL_3_PARENT_1_ID]: {
                readerCommentsEnabled: false,
                readerRatingEnabled: false,
                readConfirmationEnabled: false,
            },
        };
        const resolvedConfig = resolveReaderFeedbackConfigForItem(ITEM_ID, ancestors, configs);
        expect(resolvedConfig).toEqual({
            readerCommentsEnabled: false,
            readerRatingEnabled: false,
            readConfirmationEnabled: false,
        });
    });

    it("returns the parent items config when the item is an instance that inherits from parents", () => {
        const ancestors: DocumentAncestors = {
            [ITEM_ID]: [LVL_1_PARENT_1_ID, LVL_1_PARENT_2_ID],
            [LVL_1_PARENT_1_ID]: [LVL_2_PARENT_1_ID],
            [LVL_2_PARENT_1_ID]: [LVL_3_PARENT_1_ID],
            [LVL_1_PARENT_2_ID]: [LVL_3_PARENT_1_ID],
        };
        const configs:  Record<string, ReaderFeedbackConfig> = {
            [LVL_1_PARENT_1_ID]: undefined,
            [LVL_1_PARENT_2_ID]: {  // Overrides parent LVL_3_PARENT_1_ID
                readerCommentsEnabled: null,
                readerRatingEnabled: true,
                readConfirmationEnabled: null,
            },
            [LVL_2_PARENT_1_ID]: {  // Inherits from parent LVL_3_PARENT_1_ID
                readerCommentsEnabled: undefined,
                readerRatingEnabled: null,
                readConfirmationEnabled: undefined,
            },
            [LVL_3_PARENT_1_ID]: {
                readerCommentsEnabled: false,
                readerRatingEnabled: false,
                readConfirmationEnabled: false,
            },
        };
        const resolvedConfig = resolveReaderFeedbackConfigForItem(ITEM_ID, ancestors, configs);
        expect(resolvedConfig).toEqual({
            readerCommentsEnabled: true,
            readerRatingEnabled: true,
            readConfirmationEnabled: false,
        });
    });

    it("returns default for all flags when there is no config to cover the case of a new account", () => {
        const ancestors: DocumentAncestors = {
            [ITEM_ID]: [LVL_1_PARENT_1_ID],
            [LVL_1_PARENT_1_ID]: [LVL_2_PARENT_1_ID],
            [LVL_2_PARENT_1_ID]: [LVL_3_PARENT_1_ID],
        };
        const configs:  Record<string, ReaderFeedbackConfig> = {};
        const resolvedConfig = resolveReaderFeedbackConfigForItem(ITEM_ID, ancestors, configs);
        expect(resolvedConfig).toEqual({
            readerCommentsEnabled: true,
            readerRatingEnabled: true,
            readConfirmationEnabled: false,
        });
    });
});
