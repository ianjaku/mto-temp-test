import * as React from "react";
import { Application, EventType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { EditorEvent, captureFrontendEvent } from "@binders/client/lib/thirdparty/tracking/capture";
import { AccountSwitcher } from "./AccountSwitcher";
import { COMPOSER_ROUTE } from "../../documents/Composer/routes";
import { FlashMessages } from "../../logging/FlashMessages";
import SearchBar from "@binders/ui-kit/lib/elements/searchBar";
import { cleanESQuery } from "@binders/client/lib/util/elastic";
import cx from "classnames";
import eventQueue from "@binders/client/lib/react/event/EventQueue";
import { isMobileView } from "@binders/ui-kit/lib/helpers/rwd";
import { useActiveAccountId } from "../../accounts/hooks";
import { useActiveCollection } from "../hooks";
import { useCurrentUserId } from "../../users/hooks";
import { useLocation } from "react-router";
import "./TopBar.styl";

export const TopBar = ({
    allAccountsAction,
    hideAccountSwitcher,
}: {
    allAccountsAction?: () => void;
    hideAccountSwitcher: boolean;
}) => {
    const accountId = useActiveAccountId();
    const activeCollection = useActiveCollection();
    const userId = useCurrentUserId();
    const location = useLocation();
    const isComposerRoute = location.pathname.startsWith(COMPOSER_ROUTE);
    return (
        <div className={cx("topBar", isComposerRoute ? "topBar-inComposer" : null)}>
            <SearchBar
                cleanESQuery={cleanESQuery}
                flashmessages={FlashMessages}
                onSubmit={(query) => {
                    captureFrontendEvent(EditorEvent.SubmittedSearchbarQuery, { query, fromSearchPage: false });
                    eventQueue.log(
                        EventType.SEARCHED,
                        accountId,
                        {
                            query,
                            escapedQuery: cleanESQuery(query),
                            application: Application.EDITOR
                        },
                        false,
                        userId,
                    );
                }}
                scopeCollectionId={activeCollection}
            />
            {
                isMobileView() ?
                    null :
                    <AccountSwitcher
                        hideAccountSwitcher={hideAccountSwitcher}
                        allAccountsAction={allAccountsAction}
                    />
            }
        </div>
    );
}

