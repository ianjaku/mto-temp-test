import * as React from "react";
import BindersLanguageViewsPerCollection from "@binders/ui-kit/lib/stats/binderslanguageviewspercollection";
import { ILanguageStatistics } from "@binders/client/lib/clients/trackingservice/v1/contract";
import Layout from "../../shared/Layout/Layout";
import Loader from "@binders/ui-kit/lib/elements/loader/index";
import { RouteComponentProps } from "react-router";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { browseInfoFromRouteParams } from "../routes";
import { useCollectionLanguageStatistics } from "../hooks";
import { useTranslation } from "react-i18next";
import "./analytics.styl";


const CollectionAnalyticsViewer: React.FC<RouteComponentProps<{ collectionId: string }>> = ({ history, location, match }) => {
    const { t } = useTranslation();
    const modalPlaceholderRef = React.useRef<HTMLDivElement>();
    const { data, isLoading, isSuccess, isError } = useCollectionLanguageStatistics(match.params.collectionId);
    const analytics = data?.collectionLanguageAnalytics ?? [];

    return (
        <div ref={modalPlaceholderRef}>
            <Layout
                className="analytics-viewer"
                match={match}
                history={history}
                location={location}
                containerClassName="container"
                hideBreadcrumbs={true}
                innerContainerClassName="container-inner"
                modalPlaceholder={modalPlaceholderRef?.current}
                browseInfoFromRouteParams={browseInfoFromRouteParams}
                showMyLibraryLink={true}
            >
                <div className="analytics-wrapper">
                    {isLoading ? <Loader text={t(TK.Analytics_Fetching)} /> : null}
                    {isError ?
                        <div className="analytics-viewer-empty">
                            <h1 className="analytics-viewer-empty-description">
                                {t(TK.Analytics_CollectionFailed)}
                            </h1>
                        </div> :
                        null
                    }
                    {isSuccess ? <CollectionAnalytics analytics={analytics} /> : null}
                </div>
            </Layout>
        </div>
    );
}

const CollectionAnalytics: React.FC<{ analytics: ILanguageStatistics[] }> = ({ analytics }) => {
    const { t } = useTranslation();
    return analytics.length === 0 ?
        <div className="analytics-viewer-empty">
            <h1 className="analytics-viewer-empty-title">
                {t(TK.Analytics_CollectionEmptyTitle)}
            </h1>
            <p className="analytics-viewer-empty-description">
                {t(TK.Analytics_CollectionEmptyDescription)}
            </p>
        </div> :
        <div className="analytics-container">
            <BindersLanguageViewsPerCollection
                languageStats={analytics}
                title={t(TK.Analytics_LangViews)}
            />
        </div>
}

export default CollectionAnalyticsViewer;