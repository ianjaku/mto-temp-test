import * as React from "react";
import { useEffect } from "react";
import { useFetchLaunchDarklyFlags } from "./hooks";
import {
    useLaunchDarklyFlagsStoreActions
} from "@binders/ui-kit/lib/thirdparty/launchdarkly/ld-flags-store";

export const LaunchDarklyFlagsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { data: launchDarklyFlags } = useFetchLaunchDarklyFlags();
    const { setLaunchDarklyFlags } = useLaunchDarklyFlagsStoreActions();
    useEffect(() => {
        setLaunchDarklyFlags(launchDarklyFlags);
    }, [launchDarklyFlags, setLaunchDarklyFlags]);

    return <>{children}</>
}