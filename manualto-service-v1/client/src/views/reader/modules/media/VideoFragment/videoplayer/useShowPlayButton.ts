import { useEffect, useState } from "react";

/**
 * Hide the play button for an additional 500ms after loading or inactivity when autoplay is enabled
 * so we don't flash the play button very shortly before the video starts playing.
 */
export const usePlayButtonVisible = (paused: boolean, loading: boolean, isActive: boolean, autoPlay: boolean): boolean => {
    const [showPlayButton, setShowPlayButton] = useState(false);
    const [prevLoading, setPrevLoading] = useState(false);
    const [prevActive, setPrevActive] = useState(false);

    useEffect(() => {
        const shouldShow = paused && !loading && isActive;
        
        if ((!prevLoading || !prevActive) && shouldShow) {
            const timer = setTimeout(() => {
                setShowPlayButton(true);
            }, 100);
            return () => clearTimeout(timer);
        } else {
            setShowPlayButton(shouldShow);
        }
    }, [
        paused,
        loading,
        setShowPlayButton,
        showPlayButton,
        isActive,
        autoPlay,
        prevLoading,
        prevActive
    ]);

    useEffect(() => setPrevLoading(loading), [loading]);
    useEffect(() => setPrevActive(isActive), [isActive]);

    return showPlayButton;
}
