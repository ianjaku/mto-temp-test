import * as React from "react";
import {
    Binder,
    DocumentCollection
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BrowseSharingModal } from "../sharing/BrowseSharingModal";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { findSemanticLinks } from "../../documents/actions/loading";
import { useShowModal } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { useTranslation } from "@binders/client/lib/react/i18n";

export interface BrowseShareButtonProps {
    item: DocumentCollection | Binder;
}

export function useBrowseShareButton({ item }: BrowseShareButtonProps) {
    const { t } = useTranslation();
    const showSharingModal = useShowModal<BrowseShareButtonProps, unknown>(({ hide }) => (
        <BrowseSharingModal
            hide={hide}
            item={item}
        />
    ));
    const onClick = React.useCallback(() => {
        findSemanticLinks(item.id);
        showSharingModal({ item });
    }, [item, showSharingModal])
    return {
        onClick,
        tooltipMessage: t(TK.DocManagement_ShareTitle)
    };
}


