export function downloadCsvTextFile(contents: string, fileName = "imported-users.csv"): void {
    const encodedUri = "data:text/csv;charset=utf-8,%EF%BB%BF" + encodeURI(contents);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
}

export const containsInValues = (query: string, record: Record<string, unknown> | string | null | undefined): boolean => {
    if (!record) return false;
    const lowerQuery = query.toLowerCase();
    if (typeof record === "string") {
        return record.toLowerCase().includes(lowerQuery);
    }
    for (const val of Object.values(record)) {
        if (val == null) continue;
        if (typeof val === "string" && val.toLowerCase().includes(lowerQuery)) {
            return true;
        }
        if (Array.isArray(val) && val.some((v) => containsInValues(query, v))) {
            return true;
        }
        if (val && typeof val === "object" && !Array.isArray(val)) {
            if (containsInValues(query, val as Record<string, unknown>)) {
                return true;
            }
        }

    }
    return false;
};
