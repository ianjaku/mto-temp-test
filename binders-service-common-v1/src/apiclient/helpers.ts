import fetch from "node-fetch";

export async function parseBodyInFetchResponse<T>(response: fetch.Response): Promise<T> {
    const rawBody = await response.text();
    let body: T;
    try {
        body = JSON.parse(rawBody);
    } catch (error) {
        body = rawBody as unknown as T;
    }
    return body;
}