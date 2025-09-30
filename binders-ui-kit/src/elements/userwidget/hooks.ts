import { useWindowDimensions } from "../../hooks/useWindowDimensions";

export const useShouldDisplayName = () => {
    const { width: windowWidth } = useWindowDimensions();
    return windowWidth >= 600;
};