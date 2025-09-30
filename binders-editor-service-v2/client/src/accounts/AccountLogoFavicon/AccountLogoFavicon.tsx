import * as React from "react";
import { useActiveAccount, useActiveAccountFeatures } from "../hooks";
import { FC } from "react";
import {
    FEATURE_BROWSER_LOGO_FAVICON
} from  "@binders/client/lib/clients/accountservice/v1/contract";
import { TabInfo } from "@binders/ui-kit/lib/elements/tabinfo/TabInfo";

export const AccountLogoFavicon: FC = () => {
    const account = useActiveAccount();
    const features = useActiveAccountFeatures();
    const faviconUrl = React.useMemo(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (account?.thumbnail as any)?.buildRenderUrl({ requestedFormatNames: ["thumbnail"] });
    }, [account]);

    if (!features?.includes(FEATURE_BROWSER_LOGO_FAVICON)) {
        return null;
    }
    return (
        <TabInfo faviconUrl={faviconUrl} />
    )
}
