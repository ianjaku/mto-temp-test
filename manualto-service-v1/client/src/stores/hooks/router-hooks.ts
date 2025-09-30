import { useLocation } from "react-router-dom";
import { useMemo } from "react";

export const useSearchParams = (): URLSearchParams => {
    const location = useLocation();
    return useMemo(() => {
        if (!location.search) return null;
        return new URLSearchParams(location.search);
    }, [location]);
}
