import { CredentialServiceClient } from "../clients/credentialservice/v1/client";
import { ImpersonationInfo } from "../clients/credentialservice/v1/contract";
import browserRequestHandler from "../clients/browserClient";
import { config } from "../config";
import { doPost } from "../clients/request";

const credentialClient = CredentialServiceClient.fromConfig(config, "v1", browserRequestHandler);

export async function startImpersonation(
    accountId: string,
    userId: string,
    originalUserId: string,
    options?: {
        isDeviceUserTarget?: boolean,
        redirectRoute?: string,
        password?: string
    },
): Promise<void> {
    const { isDeviceUserTarget, redirectRoute } = options || {};
    const [impersonatedSession, originalUserToken] = await Promise.all([
        credentialClient.getImpersonatedSession(userId, accountId, options?.password),
        credentialClient.createOneTimeToken(originalUserId, 1, accountId), // this token will (at stop impersonation) serve to create a new session for the original user that initialized the impersonation
    ]);
    const result = await doPost("/impersonate", {
        impersonatedSession,
        originalUserToken,
        isDeviceUserTarget,
    });
    if (result.status !== 200) {
        // eslint-disable-next-line no-console
        console.error(result);
        return;
    }
    window.location.href = redirectRoute || "/";
}

export function stopImpersonation(domain?: string): void {
    window.location.href = `/stopimpersonation${domain ? `?domain=${domain}` : ""}`;
}

export function getImpersonationInfo(): ImpersonationInfo {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { impersonation: impersonationStr } = window as any;
    return impersonationStr && JSON.parse(impersonationStr);
}

export function isAdminImpersonation(): boolean {
    const impersonationInfo = getImpersonationInfo();
    if (impersonationInfo == null) return false;
    const { isDeviceUserTarget } = impersonationInfo;
    if (isDeviceUserTarget == null) return false;
    return !isDeviceUserTarget;
}

export function isDeviceTargetUserImpersonation(): boolean | null {
    const impersonationInfo = getImpersonationInfo();
    if (impersonationInfo != null) {
        const { isDeviceUserTarget } = impersonationInfo;
        return isDeviceUserTarget;
    }
    return null;
}