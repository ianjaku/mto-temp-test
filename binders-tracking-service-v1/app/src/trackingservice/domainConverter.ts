import { IUserAccessedUrlData } from "@binders/client/lib/clients/trackingservice/v1/contract";

type StringKeys<T> = {
    [K in keyof T]: T[K] extends string | undefined ? K : never;
}[keyof T];

const fieldsToCheck: StringKeys<IUserAccessedUrlData>[] = [
    "host",
    "referer",
    "url",
    "href",
    "domain",
    "hostname",
    "origin",
    "search"
];

export function urlDataNeedsDomainUpdate(
    data: IUserAccessedUrlData,
    oldDomain: string
): boolean {
    if (!oldDomain) {
        return false
    }
    return fieldsToCheck.some(field => {
        const value = data[field];
        return value && value.includes(oldDomain);
    });
}

export function updateDomainInUrlData(
    data: IUserAccessedUrlData,
    oldDomain: string,
    newDomain: string
): IUserAccessedUrlData {
    if (!newDomain || !oldDomain) {
        return data
    }

    const regex = new RegExp(oldDomain, "g");
    const newData: IUserAccessedUrlData = { ...data };

    fieldsToCheck.forEach(field => {
        if (newData[field] && typeof newData[field] === "string") {
            newData[field] = (newData[field] as string).replace(regex, newDomain);
        }
    });

    return newData;
}
