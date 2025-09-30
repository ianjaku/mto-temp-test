import * as React from "react";
import { FC } from "react";
import { FEATURE_STREAMING_DEBUG } from "@binders/client/lib/clients/accountservice/v1/contract";
import { isProduction } from "@binders/client/lib/util/environment";
import {
    useIsAccountFeatureActive
} from  "../../../../../stores/hooks/account-hooks";

/**
 * Shows whatever is passed as {message} in the bottom right of the video player.
 */
export const VideoMethodDebugger: FC<{ message: string }> = (props) => {
    const videoDebuggingEnabled = useIsAccountFeatureActive(FEATURE_STREAMING_DEBUG);
    const isProd = isProduction();

    if (!videoDebuggingEnabled || isProd) return null;
    return (
        <div style={{
            position: "absolute",
            bottom: "10px",
            right: "10px",
            color: "white"
        }}>
            {props.message}
        </div>
    )
}
