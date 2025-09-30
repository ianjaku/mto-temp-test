import {
    ACTION_UPDATE_SEMANTICLINKS,
    KEY_ACTIVE_BINDER_PUBLICATIONS,
    KEY_BINDER_CLEAR_SAVING_INFO,
    KEY_CLEAR_ACTIVE_BINDER,
    KEY_LOAD_SEMANTICLINKS
} from "../store";
import BinderClass, { create as createBinder } from "@binders/client/lib/binders/custom/class";
import { KEY_ACTIVE_BINDER, KEY_BACKEND_META_MODULE, } from "../store";
import { APIFindSemanticLinks } from "../../accounts/api";
import { APILoadBinder } from "../api";
import { APILoadPublications } from "../api";
import AccountStore from "../../accounts/store";
import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { FEATURE_NOCDN } from "@binders/client/lib/clients/accountservice/v1/contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { TipTapExtensions } from "../Composer/components/BinderLanguage/TextEditor/TextEditor";
import { deserializeEditorStates } from "@binders/client/lib/draftjs/helpers";
import { dispatch } from "@binders/client/lib/react/flux/dispatcher";
import { generateJSON } from "@tiptap/core";
import i18next from "@binders/client/lib/react/i18n";
import { wrapAction } from "../../shared/fluxwebdata";

export function normalizeBinderJson(binder: Binder): Binder {
    const needsNormalization = binder.modules?.text?.chunked?.some(chunkedModule =>
        !chunkedModule.json || chunkedModule.json.some(entry => !entry)
    );
    if (!needsNormalization) {
        return binder;
    }
    const normalizedBinder = JSON.parse(JSON.stringify(binder)) as Binder;
    if (normalizedBinder.modules?.text?.chunked) {
        normalizedBinder.modules.text.chunked.forEach(chunkedModule => {
            if (!chunkedModule.json) {
                chunkedModule.json = [];
            }
            while (chunkedModule.json.length < chunkedModule.chunks.length) {
                chunkedModule.json.push("");
            }
            for (const [chunkIndex, chunkContent] of chunkedModule.chunks.entries()) {
                if (!chunkContent || !chunkContent.length || chunkedModule.json[chunkIndex]) {
                    continue;
                }
                const htmlContent = (chunkContent || []).flat().join("");
                try {
                    const generatedJson = generateJSON(htmlContent, TipTapExtensions);
                    chunkedModule.json[chunkIndex] = JSON.stringify(generatedJson);
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.error(`Failed to generate JSON for chunk ${chunkIndex}:`, error);
                }
            }
        });
    }
    return normalizedBinder;
}

export const loadBinder = async (binderId: string, shouldUseNewTextEditor: boolean = false): Promise<BinderClass> => {
    const towrap = async (): Promise<BinderClass> => {
        const accountFeaturesWD = AccountStore.getAccountFeatures();
        const cdnnify = !(accountFeaturesWD.result.includes(FEATURE_NOCDN));
        const binder = await APILoadBinder(binderId, { cdnnify });
        const normalizedBinder = shouldUseNewTextEditor ? normalizeBinderJson(binder) : binder;
        const editorStates = deserializeEditorStates(normalizedBinder);
        const binderObject = createBinder(editorStates);
        dispatch({
            type: KEY_BACKEND_META_MODULE,
            body: binderObject.getModules().meta,
        });
        return binderObject;
    };
    return wrapAction(
        towrap,
        KEY_ACTIVE_BINDER,
        i18next.t(TK.DocManagement_DocLoadFail)
    );
}

export const loadPublications = async (binderId, activePublicationsOption?) => {
    const towrap = async () => {
        const publications = await APILoadPublications(binderId, activePublicationsOption);
        return publications;
    }
    return wrapAction(
        towrap,
        KEY_ACTIVE_BINDER_PUBLICATIONS,
        i18next.t(TK.DocManagement_DocLoadFail)
    );
};

export const clearActiveBinder = () => {
    dispatch({
        type: KEY_CLEAR_ACTIVE_BINDER
    });
    dispatch({
        type: KEY_BINDER_CLEAR_SAVING_INFO
    });
};

export const findSemanticLinks = binderId =>
    wrapAction(
        () => APIFindSemanticLinks(binderId),
        KEY_LOAD_SEMANTICLINKS,
        i18next.t(TK.DocManagement_SemLinkLoadFail),
    );

export const refreshSemanticLinks = async binderId => {
    const semanticLinks = await APIFindSemanticLinks(binderId);
    dispatch({
        type: ACTION_UPDATE_SEMANTICLINKS,
        body: semanticLinks,
    })
}
