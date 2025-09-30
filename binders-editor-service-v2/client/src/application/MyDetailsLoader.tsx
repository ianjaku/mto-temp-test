import { useGetMyDetails } from "../users/query";

export function MyDetailsLoader() {
    useGetMyDetails();
    return null;
}
