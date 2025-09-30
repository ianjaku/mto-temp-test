import * as React from "react";
import {
    activatePublication,
    dispatchLoadingItem,
    findPublication,
    loadParentPathContext,
    selectLanguage
} from "../binders/binder-loader";
import { AccountFeatures } from "@binders/client/lib/clients/accountservice/v1/contract";
import CollectionBrowser from "../views/browsing/collection-browser";
import { ContentChunkKind } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { DocumentType } from "@binders/client/lib/clients/model";
import Loader from "../views/components/loader";
import NotFound from "../views/errorpages/notfound";
import Reader from "../views/reader/reader.lazy";
import { RouteComponentProps } from "react-router-dom";
import { getReaderDomain } from "../util";
import { getSemanticLinkById } from "../api/routingservice";
import { logDocumentOpened } from "./tsHelpers";
import { navigateToLaunchPath } from "../navigation";
import { resolveAdditionalChunks } from "../utils/additionalChunks";
import { useActiveAccountFeatures } from "../stores/hooks/account-hooks";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";

export type SemanticIdComponentProps = {
    router: RouteComponentProps;
    accountIds: string[];
    additionalChunks: ContentChunkKind[];
    features: AccountFeatures;
};

export type SemanticIdComponentState = {
    itemNotFound: boolean;
    binderId?: string;
    languageCode?: string;
    documentType?: DocumentType;
};

class SemanticIdComponent extends React.Component<SemanticIdComponentProps, SemanticIdComponentState> {
    constructor(props: SemanticIdComponentProps) {
        super(props);
        this.state = {
            documentType: undefined,
            itemNotFound: false,
        };
    }

    async componentDidMount(): Promise<void> {
        const { router: { location: { pathname } } } = this.props;
        const semanticId = pathname.replace(/^\/|\/$/g, "");
        if (semanticId) {
            this.activateItem(semanticId);
        }
    }

    async activateItem(semanticId: string): Promise<void> {
        const { router, accountIds } = this.props;
        const domain = getReaderDomain();

        let semanticLinks;
        try {
            semanticLinks = await getSemanticLinkById(semanticId, domain);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error("Error while fetching semantic link for id", semanticId, e);
            if (e.statusCode === 401) {
                const currentSearch = window.location.search.replace("?", "&");
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (window as any).location = `/login?redirectUrl=${window.location.pathname}${currentSearch}`;
                return;
            }
            semanticLinks = [];
        }
        if (semanticLinks.length > 0) {
            let semanticLink = semanticLinks.find(link => link.semanticId === semanticId);
            semanticLink = semanticLink || semanticLinks[0];
            const { binderId, documentType, languageCode } = semanticLink;
            if (documentType === DocumentType.DOCUMENT) {
                let publication;
                let parentPathContext;
                try {
                    dispatchLoadingItem(binderId);
                    parentPathContext = await loadParentPathContext(accountIds, binderId, languageCode, { triggerParentCollectionActivate: true });
                    const additionalChunks = resolveAdditionalChunks(
                        this.props.features,
                        parentPathContext.ratingEnabled,
                        parentPathContext.readConfirmationEnabled,
                    );
                    publication = await findPublication(
                        router,
                        binderId,
                        languageCode,
                        additionalChunks,
                    );
                } catch (error) {
                    this.handleError(error);
                }
                const publicationLanguage = publication.language.iso639_1;
                if (publicationLanguage !== languageCode) {
                    // the found publication is not in the language of the semantic link
                    // redirect user to the default language
                    navigateToLaunchPath(router.history, binderId, {
                        lang: publicationLanguage,
                        domain: getReaderDomain(),
                        redirectedFromLangCode: languageCode,
                    });
                    return;
                }
                activatePublication(publication);
                selectLanguage(languageCode);
                logDocumentOpened(publication, parentPathContext, accountIds[0], undefined, semanticLink.id);
            }
            this.setState({
                documentType,
                binderId,
                languageCode,
            });
        } else {
            this.setState({
                itemNotFound: true
            });
        }
    }

    handleError(err: { statusCode: number }): void {
        if (err.statusCode === 404) {
            this.setState({
                itemNotFound: true
            });
        }
    }

    render(): React.JSX.Element {
        const { router, accountIds } = this.props;
        const { documentType, binderId, languageCode, itemNotFound } = this.state;
        const documentTypeExists = (documentType !== undefined);
        if (itemNotFound) {
            return <NotFound history={router.history} />;
        }
        if (!binderId) {
            return <Loader />;
        }
        if (documentTypeExists && documentType === DocumentType.DOCUMENT) {
            return <Reader router={router} />;
        }
        if (documentTypeExists && documentType === DocumentType.COLLECTION) {
            return (<CollectionBrowser accountIds={accountIds} router={router} collectionId={binderId} semanticLinkLanguageCode={languageCode} />);
        }
        return (<div />);
    }
}

export default withHooks(SemanticIdComponent, () => ({
    features: useActiveAccountFeatures(),
}));