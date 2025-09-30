import { APILoadDeletedItems, APIRestoreItem } from "./api";
import {
    AccountFeatures,
    FEATURE_NOCDN,
    FEATURE_READONLY_EDITOR
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { appendValues, deleteFromTrash, setValues } from "./store";
import { APIDeleteBinder } from "../documents/api";
import { FlashMessages } from "../logging/FlashMessages";
import { PermissionMap } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { SoftDeletedItemsFilter } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { fetchAndBuildParentItemsMap } from "./helpers";
import i18next from "@binders/client/lib/react/i18n";
import { indexBy } from "ramda";

const DELETED_ITEMS_BATCH_SIZE = 150;

/**
 * Pagination:
 * - Fetch all items, starting from the date of the currently oldest item
 * - Load 1 extra item to see if the load more button still has to be shown
 */
export const loadDeletedItems = async (
    accountId: string,
    accountFeatures: AccountFeatures,
    filter: SoftDeletedItemsFilter,
    permissions: PermissionMap[],
    mergeWithExisting = false
): Promise<void> => {
    try {
        const cdnnify = !(accountFeatures.includes(FEATURE_NOCDN));
        const isReadonlyEditorOn = accountFeatures.includes(FEATURE_READONLY_EDITOR);
        const {users, items, parentMap} = await APILoadDeletedItems(
            accountId,
            filter,
            cdnnify,
            DELETED_ITEMS_BATCH_SIZE + 2 // current oldest + extra item for moreItemsExist
        );
        
        const moreItemsExist = items.length > DELETED_ITEMS_BATCH_SIZE;
        const offset = mergeWithExisting ? 1 : 0;
        const itemsBatch = items.slice(
            offset,
            DELETED_ITEMS_BATCH_SIZE + offset
        );

        const parentItemsMap = await fetchAndBuildParentItemsMap(
            itemsBatch,
            parentMap,
            accountId,
            permissions,
            isReadonlyEditorOn
        );
        const usersById = indexBy(user => user.id, users);

        if (mergeWithExisting) {
            appendValues(itemsBatch, parentItemsMap, usersById, moreItemsExist);
        } else {
            setValues(itemsBatch, parentItemsMap, usersById, moreItemsExist);
        }
    } catch(ex) {
        FlashMessages.error(i18next.t(TK.Trash_DeletedItemsDownloadFail));
        throw ex;
    }
}

export enum PostRestoreAction { flashMsg, redirect }

export const restoreItem = async (
    itemId: string,
    accountId: string,
    parentCollectionId: string,
    postRestoreAction: PostRestoreAction = PostRestoreAction.flashMsg,
): Promise<void> => {
    try {
        await APIRestoreItem(itemId, accountId, parentCollectionId);
        deleteFromTrash(itemId);
        const browsePath = `/browse/${parentCollectionId}?attentionTo=${itemId}`;
        if (postRestoreAction === PostRestoreAction.flashMsg) {
            FlashMessages.success(
                `${i18next.t(TK.Trash_SuccessRestore)}&nbsp; <a class="deletedItems-link" href='${browsePath}'>${i18next.t(TK.Trash_ShowRestoredItem)}</a>`,
                true
            );
            return;
        }
        window.location.href = browsePath;
    } catch (ex) {
        FlashMessages.error(i18next.t(TK.Trash_ProblemRestoring));
    }
}
export const hardDeleteBinder = async (id: string, accountId: string) : Promise<void> => {
    try {
        await APIDeleteBinder(id, accountId, true);
        deleteFromTrash(id);
    } catch (ex) {
        FlashMessages.error(i18next.t(TK.DocManagement_ItemDeleteFail));
    }
}
