import * as React from "react";
import { buildViewsAnalytics, renderLanguageAnalytics } from "./helper";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { ActivePublicationsOption } from "../../documents/api";
import DocViewsStat from "@binders/ui-kit/lib/stats/docviews";
import FallbackComponent from "../../application/FallbackComponent";
import Layout from "../../shared/Layout/Layout";
import Loader from "@binders/ui-kit/lib/elements/loader";
import type { RouteComponentProps } from "react-router";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import TimePerChunkStat from "@binders/ui-kit/lib/stats/timeperchunk";
import { browseInfoFromRouteParams } from "../routes";
import colors from "@binders/ui-kit/lib/variables";
import { loadBrowseContext } from "../../browsing/actions";
import { useAllBinderStatistics } from "../hooks";
import { useMyDetails } from "../../users/hooks";
import { useMyPermissionMapOrEmpty } from "../../authorization/hooks";
import { useSetDefaultAnalyticsRange } from "../../users/query";
import { useSortedBinderPublications } from "../../documents/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./analytics.styl";

export function DocumentAnalyticsViewer(props: RouteComponentProps<{ documentId?: string; }>) {
    const { t } = useTranslation();
    const myDetails = useMyDetails();
    const setDefaultRange = useSetDefaultAnalyticsRange();
    const modalPlaceholderRef = useRef<HTMLDivElement>();
    const permissions = useMyPermissionMapOrEmpty();

    const { location, match, history } = props;
    const { documentId } = match.params;

    const { data: analytics, isError: isAnalyticsError, isLoading: isAnalyticsLoading } = useAllBinderStatistics(documentId);
    const { data: publications, isError: isPublicationsError, isLoading: isPublicationsLoading } = useSortedBinderPublications(documentId, ActivePublicationsOption.AllExceptInactiveWithNoViews, true);
    const isError = isAnalyticsError || isPublicationsError;
    const isLoading = isAnalyticsLoading || isPublicationsLoading;

    const {
        chunkTimings,
        languageStatistics,
        viewsAnalytics,
        viewsPerMonthStatistics,
    } = analytics ?? {};

    const publicationTimingsSummaries = useMemo(() => {
        return Object.entries(chunkTimings ?? {})
            .map(([publicationId, chunkTimingsMap]) => [publications?.find(p => p.id === publicationId), chunkTimingsMap] as const)
            .filter(([publication]) => publication != null)
            .map(([publication, chunkTimingsMap]) => {
                const viewsSummary = publication.viewsSummary;
                const views = viewsSummary ?
                    Object.keys(viewsSummary).reduce((viewsSoFar, userId) => (
                        viewsSoFar + viewsSummary[userId]
                    ), 0) :
                    0;
                return {
                    id: publication.id,
                    created: new Date(publication.publicationDate),
                    language: publication.language,
                    chunkTimingsMap,
                    isActive: publication.isActive,
                    views,
                };
            });
    }, [chunkTimings, publications]);

    const browseInfo = useMemo(
        () => browseInfoFromRouteParams(match.params /*, true */),
        [match.params],
    );

    useEffect(() => {
        loadBrowseContext(browseInfo, true, permissions);
    }, [browseInfo, permissions]);

    const updateDefaultRange = useCallback((range: string) => {
        const userId = myDetails?.user?.id;
        if (!userId) return;
        setDefaultRange.mutate({ userId, defaultAnalyticsRange: range })
    }, [myDetails, setDefaultRange]);

    const analyticsRange = myDetails?.preferences.defaultAnalyticsRange;

    if (isLoading) {
        return <Loader text={t(TK.Analytics_Fetching)} />;
    }

    if (isError) {
        return <FallbackComponent exception={t(TK.Analytics_LoadFail)} />;
    }

    return (
        <div ref={modalPlaceholderRef}>
            <Layout
                className="analytics-viewer"
                match={match}
                history={history}
                location={location}
                modalPlaceholder={modalPlaceholderRef.current}
                browseInfoFromRouteParams={browseInfoFromRouteParams}
            >
                <div className="analytics-wrapper">
                    {documentId && <div className="analytics-container">
                        <DocViewsStat
                            updateDefaultRange={updateDefaultRange}
                            defaultRange={analyticsRange}
                            title={t(TK.Analytics_DocViewsTime)}
                            ranges={buildViewsAnalytics(
                                viewsAnalytics,
                                viewsPerMonthStatistics,
                                documentId,
                            )}
                            lineColor={colors.accentColor}
                            renderAsBars={true}
                            hatchLastBar={true}
                        />
                    </div>}
                    <div className="analytics-container">
                        <TimePerChunkStat
                            publicationTimingsSummaries={publicationTimingsSummaries}
                            title={t(TK.Analytics_TimePerChunk)}
                        />
                    </div>
                    {languageStatistics && languageStatistics.length > 1 &&
                        renderLanguageAnalytics(languageStatistics)}
                </div>
            </Layout>
        </div>
    );
}

export default DocumentAnalyticsViewer;
