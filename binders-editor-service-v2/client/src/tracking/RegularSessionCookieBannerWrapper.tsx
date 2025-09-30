import * as React from "react";
import { CookieBannerWrapper } from "./CookieBannerWrapper";
import { FC } from "react";
import { useIsAdminImpersonatedSession } from "../stores/impersonation-store";

/**
 * Blocks any kind of cookie banner interaction during an impersonated session.
 */
export const RegularSessionCookieBannerWrapper: FC = () => {
    const isNotAnImpersonatedSession = !useIsAdminImpersonatedSession();
    return isNotAnImpersonatedSession && <CookieBannerWrapper />;
}
