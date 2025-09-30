import * as React from "react";
import { Application, EventType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import {
    ReaderEvent,
    captureFrontendEvent
} from "@binders/client/lib/thirdparty/tracking/capture";
import { BinderStoreGetters } from "../../stores/zustand/binder-store";
import { FaIconSearch } from "@binders/client/lib/react/icons/font-awesome";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import { cleanESQuery } from "@binders/client/lib/util/elastic";
import eventQueue from "@binders/client/lib/react/event/EventQueue";
import { getQueryStringVariable } from "@binders/client/lib/util/uri";
import { parse } from "qs";
import { toFullPath } from "../../util";
import { withTranslation } from "@binders/client/lib/react/i18n";

class SearchInput extends React.Component {
    constructor(props) {
        super(props);
        this.t = props.t;
        this.updateQuery = this.updateQuery.bind(this);
        this.activateResults = this.activateSearchResults.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        this.getQueryFromRouter = this.getQueryFromRouter.bind(this);
        const activeCollection = BinderStoreGetters.getActiveCollectionInfo();
        this.state = {
            query: this.getQueryFromRouter(),
            activeCollectionId: activeCollection?.id,
        };
    }

    getQueryFromRouter() {
        const { location } = this.props.router;
        const { q: query } = parse(location.search.substr(1));
        return decodeURIComponent(query || "");
    }

    activateSearchResults() {
        const { router, accountId, userId } = this.props;
        const { history } = router;
        const { query, activeCollectionId } = this.state;
        if (query) {
            const escapedQuery = cleanESQuery(query);
            eventQueue.log(
                EventType.SEARCHED,
                accountId,
                {
                    query,
                    escapedQuery,
                    application: Application.READER
                },
                false,
                userId,
            );
            const queryParams = new URLSearchParams();
            queryParams.set("q", encodeURIComponent(escapedQuery));
            if (getQueryStringVariable("isTest")) {
                queryParams.set("isTest", "1");
            }
            history.push(toFullPath(`/search${activeCollectionId ? `/${activeCollectionId}` : ""}?${queryParams.toString()}`));
            captureFrontendEvent(ReaderEvent.SubmittedSearchbarQuery, {
                query,
                escapedQuery,
            });
        }
    }

    updateQuery(event) {
        const query = event.target.value;
        this.setState({ query });
    }

    handleKeyPress(event) {
        if (event.key.toUpperCase() === "ENTER") {
            this.activateSearchResults();
        }
    }

    render() {
        return (
            <div className="search">
                <input
                    data-testid="search-input"
                    type="custom"
                    placeholder={this.t(TranslationKeys.General_Search)}
                    onChange={this.updateQuery}
                    onKeyPress={this.handleKeyPress}
                    value={this.state.query}
                />
                <button onClick={this.activateResults}>
                    <FaIconSearch className="search-button" />
                </button>
            </div>
        );
    }
}


export default withTranslation()(SearchInput);
