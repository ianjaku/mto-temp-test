/**
 * Saves the function call response to a file as CSV
 * @param apiCall a function that returns data as CSV
 * @param fileName the name of the file in which to save the data
 * @param onError a callback to invoke in case of failure
 * @param setLoadingState a callback to set the loading state, will be called with
 * <code>true</code> before the <code>apiCall</code> and <code>false</code> upon
 * completion of download (both on success and error)
 */
export const saveCsvToFile = async (
    apiCall: () => Promise<string>,
    fileName: string,
    onError: (e: Error) => void,
    setLoadingState: (loading: boolean) => void,
): Promise<void> => {
    setLoadingState(true);
    try {
        const csv = await apiCall();
        downloadCsvFileInBrowser(csv, fileName);
    } catch (e) {
        onError(e);
    } finally {
        setLoadingState(false);
    }
}

function downloadCsvFileInBrowser(data: BlobPart, filename: string): void {
    const blob = new Blob([data], { type: "octet/stream" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("style", "display: none");
    document.body.appendChild(link);
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
}
