import React, { FC, useEffect, useMemo } from "react";
import { User, UserType } from "@binders/client/lib/clients/userservice/v1/contract";
import { CookieStatus } from "@binders/client/lib/util/cookie";
import { LDFlags } from "@binders/client/lib/launchdarkly/flags";
import { getUserName } from "@binders/client/lib/clients/userservice/v1/helpers";
import posthog from "posthog-js";
import { useLaunchDarklyFlagValue } from "../launchdarkly/hooks";

let _initialized = false;

export const Posthog: FC<{
    accountId?: string;
    user?: User;
    cookieStatus: CookieStatus;
    disableAutoTracking?: boolean;
    disableSessionRecording?: boolean;
}> = ({ accountId, user, cookieStatus, children, disableAutoTracking, disableSessionRecording }) => {

    const isCookieRejected = cookieStatus !== CookieStatus.Accepted;

    const posthogPublicKey = useLaunchDarklyFlagValue<string>(LDFlags.POSTHOG_KEY);
    const isEnabled = useMemo(() => posthogPublicKey && posthogPublicKey.startsWith("phc_"), [posthogPublicKey]);

    useEffect(() => {
        if (!isEnabled) return;
        if (isCookieRejected) return;
        if (_initialized) return;

        posthog.init(posthogPublicKey, {
            api_host: "https://eu.i.posthog.com",
            person_profiles: "identified_only",
            ...(disableAutoTracking ? { autocapture: false } : {}),
            disable_session_recording: disableSessionRecording,
            enable_recording_console_log: true,
        });
        _initialized = true;
    }, [isCookieRejected, disableAutoTracking, disableSessionRecording, isEnabled, posthogPublicKey]);

    useEffect(() => {
        if (!isEnabled) return;
        if (isCookieRejected) return;
        if (accountId) {
            posthog.group("Account", accountId);
        }
        if (user?.id) {
            posthog.identify(user.id, {
                login: user.login,
                displayName: user.displayName,
                name: getUserName(user),
                firstName: user.firstName,
                lastName: user.lastName,
                type: UserType[user.type],
                createdAt: user.created,
                lastOnline: user.lastOnline,
                preferredLanguage: user.preferredLanguage
            });
        }
    }, [accountId, user, isCookieRejected, isEnabled]);

    return <>{children}</>;
}