import { ACTION_UPDATE_SEMANTICLINKS, KEY_PATCH_PUBLICATIONS_UPDATE } from "../../../store";
import { APIRelabelBinderLanguage } from "./api";
import { dispatch } from "@binders/client/lib/react/flux/dispatcher";

export async function relabelBinderLanguage(
    binderId: string,
    fromLanguageCode: string,
    toLanguageCode: string
): Promise<void> {
    const relabelResult = await APIRelabelBinderLanguage(binderId, fromLanguageCode, toLanguageCode)
    dispatch({
        type: KEY_PATCH_PUBLICATIONS_UPDATE,
        body: relabelResult.publications,
    });
    dispatch({
        type: ACTION_UPDATE_SEMANTICLINKS,
        body: relabelResult.semanticLinks,
    });
}
