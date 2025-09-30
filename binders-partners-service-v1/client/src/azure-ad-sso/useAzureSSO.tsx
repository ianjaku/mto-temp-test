import { InteractionRequiredAuthError, InteractionStatus, RedirectRequest } from "@azure/msal-browser";
import { useEffect, useMemo, useState } from "react";
import { useMsal } from "@azure/msal-react";

export const useAzureSSO = (): {
    accessToken: null | string,
    isLoading: boolean,
    error: null | Error
} => {
    const { instance, inProgress, accounts } = useMsal();
    const [accessToken, setAccessToken] = useState(null as null | string);
    const [error, setError] = useState(null as null | Error);

    useEffect(() => {
        const fetchAccessToken = async () => {
            if (accessToken != null) return;
            if (inProgress !== InteractionStatus.None) return;
            if (accounts.length === 0) {
                instance.loginRedirect({
                    scopes: ["User.Read"],
                });
            }
            const tokenRequestParams: RedirectRequest = {
                scopes: ["User.Read"],
                account: accounts[0],
            }
            try {
                const accessTokenResponse = await instance.acquireTokenSilent(tokenRequestParams);
                const accessToken = accessTokenResponse.accessToken;
                setAccessToken(accessToken);
            } catch (err) {
                if (err instanceof InteractionRequiredAuthError) {
                    instance.acquireTokenRedirect({
                        scopes: ["User.Read"],
                    });
                }
                setError(err);
            }
        }
        fetchAccessToken();
    }, [instance, inProgress, accounts, accessToken, setError])

    const isLoading = useMemo(() => inProgress !== InteractionStatus.None, [inProgress]);

    return {
        accessToken,
        isLoading,
        error
    }
}
