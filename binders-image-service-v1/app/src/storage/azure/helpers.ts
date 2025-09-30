export const extractContainerFromAzureStorageLocation = (storageLocation: string): string|null => {
    if (storageLocation.indexOf("azure:") >= 0) {
        const helper = storageLocation.substring(storageLocation.indexOf("visuals/") + 8);
        return helper.substring(0, helper.indexOf("/"));
    }
    return null;
};

export const extractItemIdFromAzureStorageLocation = (storageLocation: string): string|null => {
    if (storageLocation.indexOf("azure:") >= 0) {
        let substrWithContainer;
        for (const container of ["visuals", "attachments"]) {
            if (storageLocation.includes(container)) {
                substrWithContainer = storageLocation.substring(storageLocation.indexOf(container) + container.length + 1);
                break;
            }
        }
        const substr = substrWithContainer.substring(substrWithContainer.indexOf("/") + 1);
        const [part1, part2, part3] = substr.split("/");
        return `${part1}${part2}${part3}`;
    }
    return null;
};

export const extractImageIdFromAzureStorageLocation = (storageLocation: string): string|null => {
    if (storageLocation.indexOf("azure:") >= 0) {
        return storageLocation.replace(/\/\//g, "/").split("/")[6];
    }
    return null;
}
