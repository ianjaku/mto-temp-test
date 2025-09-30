import * as React from "react";
import { FC } from "react";
import { FEATURE_BROWSER_TAB_TITLE } from "@binders/client/lib/clients/accountservice/v1/contract";
import { TabInfo } from "@binders/ui-kit/lib/elements/tabinfo/TabInfo";
import { extractTitle } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { useActiveAccountFeatures } from "../../../stores/hooks/account-hooks";
import { useBrowserTabInfoItem } from "./use-browser-tab-info-item";


export const CollectionBrowserTabInfo: FC = ({ children }) => {
    const features = useActiveAccountFeatures();
    const title = useBrowserTabInfoItem(
        "tabTitle",
        (collection) => extractTitle(collection)
    );

    if (!features.includes(FEATURE_BROWSER_TAB_TITLE)) return <>{children}</>;
    return (
        <TabInfo title={title}>
            {children}
        </TabInfo>
    )
}
