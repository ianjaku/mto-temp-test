import { ACTION_UPDATE_SEMANTICLINK, ACTION_UPDATE_SEMANTICLINKS } from "../../../store";
import {
    APIDeleteSemanticLinks,
    APIIdentifyLanguageInSemanticLinks
} from "../../../../accounts/api";
import {
    DeleteSemanticLinkFilter,
    ISemanticLink,
} from "@binders/client/lib/clients/routingservice/v1/contract";
import AccountStore from "../../../../accounts/store";
import ConflictModal from "./ConflictModal";
import { FlashMessages } from "../../../../logging/FlashMessages";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { WebDataState } from "@binders/client/lib/webdata";
import { dispatch } from "@binders/client/lib/react/flux/dispatcher";
import { findSemanticLinks } from "../../../../browsing/actions";
import { setSemanticLink } from "../../../actions";
import { showModal } from "@binders/ui-kit/lib/compounds/modals/showModal";


function dispatchSemanticLink(semanticLink: ISemanticLink) {
    dispatch({
        type: ACTION_UPDATE_SEMANTICLINK,
        body: semanticLink,
    });
}

async function handleConflictWithDeleted(semanticLink: ISemanticLink): Promise<boolean> {
    const shouldOverride = await showModal(ConflictModal);
    if (!shouldOverride) {
        return false;
    }
    const result = await setSemanticLink(semanticLink, semanticLink.binderId, true);
    dispatchSemanticLink(result.semanticLink);
    return true;
}

export async function updateSemanticLink(semanticLink: ISemanticLink, t: TFunction): Promise<boolean> {
    const result = await setSemanticLink(semanticLink, semanticLink.binderId, false);
    if (result.conflict?.conflicted) {
        if (result.conflict.conflictedWithDeletedItem) {
            return handleConflictWithDeleted(semanticLink);
        }
        FlashMessages.error(t(TK.DocManagement_SemLinkSetFail, { error: t(TK.DocManagement_SemLinkInUse) }));
        return false;
    }
    dispatchSemanticLink(result.semanticLink);
    return true;
}

export async function deleteSemanticLink(semanticLink: ISemanticLink, isSoftDelete = false): Promise<void> {
    await deleteSemanticLinks({ id: semanticLink.id, binderId: semanticLink.binderId }, semanticLink.binderId, isSoftDelete);
}

export async function deleteSemanticLinks(filter: DeleteSemanticLinkFilter, binderId: string, isSoftDelete = false): Promise<void> {
    await APIDeleteSemanticLinks(filter, isSoftDelete);
    const updatedSemanticLinks = await findSemanticLinks(binderId);
    dispatch({
        type: ACTION_UPDATE_SEMANTICLINKS,
        body: updatedSemanticLinks,
    });
}

export async function identifyLanguageInSemanticLinks(
    itemId: string,
    languageCode: string
): Promise<void> {
    const domainsWD = AccountStore.getDomains();
    const domain = [...(domainsWD.state === WebDataState.SUCCESS && domainsWD.data) || []].pop();
    const updatedSemanticLinks = await APIIdentifyLanguageInSemanticLinks(domain, itemId, languageCode);
    dispatch({
        type: ACTION_UPDATE_SEMANTICLINKS,
        body: updatedSemanticLinks,
    });
}
