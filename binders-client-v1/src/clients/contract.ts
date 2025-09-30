export interface HttpResponse<T> {
    headers: Record<string, unknown>;
    status: number;
    statusCode: number;
    statusText: string;
    type?: ResponseType;
    url?: string;
    body?: T;
}
