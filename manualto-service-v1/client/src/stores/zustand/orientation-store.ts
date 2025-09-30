import { isLandscape, isPortrait } from "../../utils/viewport";
import { create } from "zustand";

const recalculateDetails = () => ({
    isLandscape: isLandscape(),
    isPortrait: isPortrait(),
})

type OrientationStore = {
    // True when the "orientationchange" event is fired (ex: device is rotated).
    // Signifies to some components to disable animations & transitions.
    // And then the orientation store updates when the resize event is fired (which always happens after an orientation change).
    waitingForResize: boolean;
    isLandscape: boolean;
    isPortrait: boolean;
}

export const useOrientationStore = create<OrientationStore>(() => ({
    ...recalculateDetails(),
    waitingForResize: false,
}));

const onOrientationChangedEvent = () => {
    useOrientationStore.setState(() => ({
        ...recalculateDetails(),
        waitingForResize: true,
    }));
}

const onResizeEvent = () => {
    useOrientationStore.setState(state => {
        const currentOrientation = recalculateDetails();
        if (currentOrientation.isLandscape === state.isLandscape &&
            currentOrientation.isPortrait === state.isPortrait) {
            return state;
        }
        return {
            ...currentOrientation,
            waitingForResize: false,
        }
    });
}

window.addEventListener("orientationchange", () => {
    onOrientationChangedEvent();
});

window.addEventListener("resize", () => {
    onResizeEvent();
});