import * as React from "react";
import Checkbox from "@binders/ui-kit/lib/elements/checkbox";
import { DocumentType } from "@binders/client/lib/clients/model";
import SemanticLinkManagerSet from "./SemanticLinkManagerSet";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { groupSemanticLinks } from "./helpers";
import { useSemanticLinks } from "../../hooks/useSemanticLinks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./SemanticLinkManager.styl";

const { useMemo, useState } = React;

interface IProps {
    itemId: string;
    publishedLangCodes: string[];
    unpublishedLangCodes: string[];
    documentType: DocumentType;
    lightTheme?: boolean;
    widthRestriction?: number;
}

const SemanticLinkManager: React.FC<IProps> = ({
    itemId,
    documentType,
    lightTheme,
    publishedLangCodes,
    unpublishedLangCodes,
    widthRestriction,
}) => {
    const { t } = useTranslation();

    const allSemanticLinks = useSemanticLinks();

    const [isDeletedFiltered, setIsDeletedFiltered] = useState(true);

    const deletedSemanticLinks = useMemo(() => allSemanticLinks.filter(l => l.deleted), [allSemanticLinks]);
    const semanticLinks = useMemo(() => isDeletedFiltered ?
        allSemanticLinks.filter(l => !(l.deleted)) :
        allSemanticLinks
    , [allSemanticLinks, isDeletedFiltered]);

    const semanticLinksMap = useMemo(() => groupSemanticLinks(semanticLinks), [semanticLinks]);

    const renderSet = React.useCallback((languageCode: string, i: number) => {
        if (!semanticLinksMap) {
            return null;
        }
        return (
            <SemanticLinkManagerSet
                itemId={itemId}
                languageCode={languageCode}
                unpublishedLangCodes={unpublishedLangCodes}
                semanticLinks={semanticLinksMap[languageCode] || []}
                key={`slSet${i}`}
                documentType={documentType}
                widthRestriction={widthRestriction}
            />
        )
    }, [semanticLinksMap, itemId, documentType, unpublishedLangCodes, widthRestriction]);

    const maybeRenderDeletedToggle = React.useCallback(() => {
        if (!deletedSemanticLinks || deletedSemanticLinks.length === 0) {
            return null;
        }
        return (
            <Checkbox
                onCheck={() => setIsDeletedFiltered(f => !f)}
                label={t(TK.DocManagement_SemLinkShowUnlocked)}
                checked={!isDeletedFiltered}
                className="semanticLinkManager-deletedToggle"
            />
        )
    }, [isDeletedFiltered, t, deletedSemanticLinks]);

    const renderSets = React.useCallback(() => {
        return [
            ...publishedLangCodes,
            ...(unpublishedLangCodes || [])
        ].map((langCode, i) => renderSet(langCode, i));
    }, [publishedLangCodes, renderSet, unpublishedLangCodes]);

    return (
        <div className={cx("semanticLinkManager", { "semanticLinkManager--lightTheme": lightTheme })}>
            {maybeRenderDeletedToggle()}
            {renderSets()}
        </div>
    )
}

export default SemanticLinkManager;