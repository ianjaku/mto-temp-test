import { useEffect, useState } from "react";
import { useAzureSSO } from "./useAzureSSO"

interface IAzureADUserInfo {
    id: string;
    displayName: string;
    givenName: string;
    surname: string;
    mail: string;
    mobilePhone?: string;
    jobTitle?: string;
    preferredLanguage?: string;
    officeLocation?: string;
    userPrincipalName: string;
}

export async function callMsGraph(accessToken: string): Promise<IAzureADUserInfo> {
    const headers = new Headers();
    const bearer = `Bearer ${accessToken}`;

    headers.append("Authorization", bearer);

    const options = {
        method: "GET",
        headers: headers
    };

    return fetch("https://graph.microsoft.com/v1.0/me", options)
        .then(response => response.json())
        // eslint-disable-next-line no-console
        .catch(error => console.log(error));
}

export const useAzureUserInfo = (): null | IAzureADUserInfo => {
    const { accessToken } = useAzureSSO();
    const [userInfo, setUserInfo] = useState(null as null | IAzureADUserInfo);

    useEffect(() => {
        const fetchUserInfo = async () => {
            if (accessToken == null) return;
            const result = await callMsGraph(accessToken)
            setUserInfo(result);
        }
        fetchUserInfo();
    }, [accessToken, setUserInfo])

    return userInfo
}
