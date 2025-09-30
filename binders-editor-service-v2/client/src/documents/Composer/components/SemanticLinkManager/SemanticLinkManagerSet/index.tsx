import * as React from "react";
import { IWebData, WebDataState } from "@binders/client/lib/webdata";
import AccountStore from "../../../../../accounts/store";
import AddChunkIcon from "@binders/ui-kit/lib/elements/icons/AddChunk";
import { DocumentType } from "@binders/client/lib/clients/model";
import { ISemanticLink } from "@binders/client/lib/clients/routingservice/v1/contract";
import RoundButton from "@binders/ui-kit/lib/elements/button/RoundButton";
import SemanticLinkManagerRow from "../SemanticLinkManagerRow";
import { useFluxStoreAsAny } from "@binders/client/lib/react/helpers/hooks";

const { useMemo } = React;
interface IProps {
    itemId: string;
    languageCode: string;
    semanticLinks: ISemanticLink[];
    documentType: DocumentType;
    unpublishedLangCodes: string[];
    widthRestriction?: number;
}

export type SemanticLinkRow = ISemanticLink & {
    isFake?: boolean,
}

function buildFakeSemanticLink(
    itemId: string,
    languageCode: string,
    documentType: DocumentType,
    domain: string,
    semanticId: string
): SemanticLinkRow {
    return {
        id: undefined,
        binderId: itemId,
        languageCode,
        documentType,
        semanticId,
        domain,
        isFake: true,
    }
}

const SemanticLinkManagerSet: React.FC<IProps> = ({
    itemId,
    semanticLinks,
    languageCode,
    documentType,
    unpublishedLangCodes,
    widthRestriction,
}) => {

    const [isHovered, setIsHovered] = React.useState(false);
    const [isFakeSemlinkShown, setIsFakeSemlinkShown] = React.useState(false);

    const domainsWD: IWebData<string[]> = useFluxStoreAsAny(AccountStore, (_prevState, store) => store.getDomains());
    const domain = useMemo(() => domainsWD.state === WebDataState.SUCCESS && [...domainsWD.data].pop(), [domainsWD]);

    const semanticLinkRows = React.useMemo<SemanticLinkRow[]>(() => {
        return [
            ...semanticLinks,
            ...(isFakeSemlinkShown ?
                [buildFakeSemanticLink(
                    itemId,
                    languageCode,
                    documentType,
                    domain,
                    "",
                )] :
                []),
        ];
    }, [semanticLinks, isFakeSemlinkShown, itemId, languageCode, documentType, domain]);

    React.useEffect(() => {
        if (!semanticLinks || !(semanticLinks.length)) {
            setIsFakeSemlinkShown(true);
        }
    }, [semanticLinks]);


    const maybeRenderAddBtn = React.useCallback(() => {
        if (!isHovered || isFakeSemlinkShown) {
            return null;
        }
        return (
            <RoundButton
                icon={<AddChunkIcon />}
                className={"button-add-semanticLink"}
                onClick={() => setIsFakeSemlinkShown(true)}
            />
        )
    }, [isFakeSemlinkShown, isHovered]);

    const handleMouseLeave = React.useCallback(() => {
        setIsHovered(false);
    }, []);

    const handleMouseEnter = React.useCallback(() => {
        setIsHovered(true);
    }, []);

    return (
        <div className="semanticLinkManager-set" data-languagecode={languageCode} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            {semanticLinkRows.map((semanticLinkRow: SemanticLinkRow, j: number) => (
                <SemanticLinkManagerRow
                    semanticLinkRow={semanticLinkRow}
                    firstInSet={j === 0}
                    key={`slRow${languageCode}${j}`}
                    setIsFakeSemlinkShown={setIsFakeSemlinkShown}
                    unpublishedLangCodes={unpublishedLangCodes}
                    widthRestriction={widthRestriction}
                />
            ))}
            {maybeRenderAddBtn()}
        </div>
    );
}

export default SemanticLinkManagerSet;