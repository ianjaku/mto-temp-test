import { APIDuplicateBinder, APIDuplicateCollection, APIGetBinder, APISaveBinder } from "../api";
import DocumentStore, {
    KEY_BACKEND_META_MODULE,
    KEY_BINDER_IS_SAVED,
    KEY_BINDER_IS_SAVING
} from "../store";
import BinderClass, {} from "@binders/client/lib/binders/custom/class";
import { DocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { IAccountInfo } from "../TranslocateItem";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { browserDebounceTime } from "../helper";
import { dispatch } from "@binders/client/lib/react/flux/dispatcher";
import i18next from "@binders/client/lib/react/i18n";
import { normalizeEmojis } from "./normalizing";
import { updateAuthors } from "../actions";

export const waitForPendingSave = async (iteration = 0): Promise<void> => {
    if (iteration > 50) {
        return Promise.reject(new Error(i18next.t(TK.Edit_CantSaveInInterval)));
    }
    if (DocumentStore.isActiveBinderDirty()) {
        return new Promise((resolve, reject) => {
            setTimeout(
                async () => {
                    try {
                        await waitForPendingSave(iteration + 1);
                        resolve();
                    } catch (error) {
                        // eslint-disable-next-line
                        console.error(error);
                        reject(error)
                    }
                },
                100
            );
        });
    } else {
        // there can be a situation, that this loops gets the information about binder being saved
        // which can be not the case, because changes are debounced for 250 ms and for IE for 1 second!
        // that't why we doubt that it is really saved before publishing and wait a little bit to be sure
        // our binder is REALLY in saved state and no other changes are hanging in the queue
        // if a change happens -> start our loop from the beginning and wait till it is saved again
        const isDirtyAfterTimeout = await new Promise(resolve => setTimeout(() => {
            resolve(DocumentStore.isActiveBinderDirty());
        }, browserDebounceTime));

        if (isDirtyAfterTimeout) {
            waitForPendingSave(0);
        }
    }
    return;
}


export const saveBinder = async (binder: BinderClass): Promise<BinderClass> => {
    dispatch({
        type: KEY_BINDER_IS_SAVING,
    });
    const normalizedBinder = normalizeEmojis(binder.toJSON());
    const newBinder = await APISaveBinder(normalizedBinder);
    dispatch({
        type: KEY_BINDER_IS_SAVED
    });
    dispatch({
        type: KEY_BACKEND_META_MODULE,
        body: newBinder.getModules().meta,
    })
    updateAuthors(newBinder.getAuthorIds())
    return newBinder;
}

export const duplicateBinder = async (
    binderId: string,
    targetCollectionId: string,
    accountInfo: IAccountInfo
): Promise<BinderClass> => {
    const binder = await APIGetBinder(binderId, { skipPopulateVisuals: true, cdnnify: false });
    if (!binder) {
        return null;
    }
    return await APIDuplicateBinder(
        binder.toJSON(),
        targetCollectionId,
        accountInfo.fromAccountId,
        accountInfo.toAccountId
    );
};

export const duplicateCollection = async (
    collectionId: string,
    targetCollectionId: string,
    targetDomainCollectionId: string,
    fromAccountId: string,
    toAccountId: string
): Promise<DocumentCollection & { kind: string }> => {
    const col = await APIDuplicateCollection(
        collectionId,
        targetCollectionId,
        targetDomainCollectionId,
        fromAccountId,
        toAccountId
    );
    return {...col, kind: "collection"};
};