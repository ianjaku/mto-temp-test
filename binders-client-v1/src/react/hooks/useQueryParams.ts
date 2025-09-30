export function useQueryParam(paramName: string): string {
    const params = useQueryParams();
    return params.get(paramName);
}

export function useQueryParams(): URLSearchParams {
    const q = window.location.search;
    const params = new URLSearchParams(q);
    return params;
}

export function useRemoveQueryParam(paramName: string): () => void {
    return () => {
        const newUrl = new URL(window.location.href);
        if (newUrl.searchParams.get(paramName)) {
            newUrl.searchParams.delete(paramName);
            window.history.replaceState(null, "", newUrl.toString());
        }
    }
}

/**
 * Machine translated language code
 */
export const QUERY_PARAM_MTLC = "mtlc";

export const QUERY_PARAM_DOMAIN = "domain";
