import * as React from "react";
import { FC, useMemo } from "react";
import { WebData, WebDataState } from "@binders/client/lib/webdata";
import AccountStore from "../../accounts/store";
import { FEATURE_BROWSER_TAB_TITLE } from "@binders/client/lib/clients/accountservice/v1/contract";
import { TabInfo } from "@binders/ui-kit/lib/elements/tabinfo/TabInfo";
import { extractTitle } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { useBrowserTabInfoItem } from "./use-browser-tab-info-item";
import { useFluxStoreAsAny } from "@binders/client/lib/react/helpers/hooks";
import { useIsRootCollection } from "../MyLibrary/root/use-is-root-collection";

export const MyLibraryTabInfo: FC<{ children?: React.ReactChildren }> = ({ children }) => {
    const features: WebData<string[]> = useFluxStoreAsAny(AccountStore, (_prevState, store) => store.getAccountFeatures());
    const inRoot = useIsRootCollection();

    const title = useBrowserTabInfoItem(
        "tabTitle",
        (collection) => extractTitle(collection)
    );

    const showTabInfo = useMemo(() => {
        if (features.state !== WebDataState.SUCCESS) return false;
        if (!features.data.includes(FEATURE_BROWSER_TAB_TITLE)) return false;
        if (inRoot) return false;
        return true;
    }, [features, inRoot])

    return (
        showTabInfo ?
            (
                <TabInfo title={title}>
                    {children}
                </TabInfo>
            ) :
            <>{children || ""}</>
    )
}
