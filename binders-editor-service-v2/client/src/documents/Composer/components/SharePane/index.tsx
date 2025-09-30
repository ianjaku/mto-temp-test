import * as React from "react";
import Binder from "@binders/client/lib/binders/custom/class";
import { DocumentType } from "@binders/client/lib/clients/model";
import SemanticLinkManager from "../SemanticLinkManager";
import { useMemo } from "react";
import { usePublishedUnpublishedLanguages } from "../../hooks/usePublishedUnpublishedLangCodes";
import "./sharePane.styl";

interface Props {
    binder: Binder,
}

const SharePane: React.FC<Props> = ({
    binder,
}) => {
    const { publishedLanguages, unpublishedLanguages } = usePublishedUnpublishedLanguages(binder);

    const publishedLangCodes = useMemo(() => publishedLanguages?.map(lang => lang.iso639_1), [publishedLanguages]);
    const unpublishedLangCodes = useMemo(() => unpublishedLanguages?.map(lang => lang.iso639_1), [unpublishedLanguages]);

    return (
        <div className="sharePane-container">
            <SemanticLinkManager
                itemId={binder.id}
                publishedLangCodes={publishedLangCodes}
                unpublishedLangCodes={unpublishedLangCodes}
                documentType={DocumentType.DOCUMENT}
            />
        </div>
    )
}

export default SharePane;
