import {
    RefObject,
    useCallback,
    useEffect,
    useState,
} from "react";
import { isMobileDevice } from "@binders/client/lib/react/helpers/browserHelper";

export type SlidingModal = {
    /**
     * Function to close the modal by moving it out of view
     * Optionally triggers an `onClose` callback if provided.
     * @param triggerOnClose - If true, the `onClose` callback will be triggered after closing the modal.
     */
    closeModal: (triggerOnClose: boolean) => void;
    /**
     * Indicates whether the modal is currently closed.
     */
    isClosed: boolean;
    /**
     * Function to open the modal and reset its position to the initial state.
     */
    openModal: () => void;
}

/**
 * Hook providing functionality for a draggable and closable modal.
 * It tracks drag events and calculates the modal's position, allowing it to be dragged and swiped to close.
 */
export const useSlidingModal = ({
    cancelableSelectors = "",
    focusableSelectors = "",
    modalRef,
    onClose,
}: {
    /**
     * A reference to the HTMLDivElement representing the modal. This ref is used for DOM manipulation, such as applying transformations during drag events.
     */
    modalRef: RefObject<HTMLDivElement>;
    /**
     * A callback that will be called when the user closes the modal
     */
    onClose?: () => void;
    /**
     * A string containing CSS selectors for elements that should not trigger dragging (e.g., inputs, buttons). If the drag starts on these elements, it will be prevented.
     */
    focusableSelectors?: string;
    /**
     * A string containing CSS selectors for elements that should cancel the dragging operation (e.g. scrollable elements inside the modal). If the drag starts on these elements, it will be canceled immediately.
     */
    cancelableSelectors?: string;
}): SlidingModal => {
    const [isDragging, setIsDragging] = useState(false);
    const [initialHeight, setInitialHeight] = useState(0);
    const [lastY, setLastY] = useState(0);
    const [translateY, setTranslateY] = useState(0);
    const [totalDragDistance, setTotalDragDistance] = useState(0);
    const [isClosed, setIsClosed] = useState(false);

    const isCancelableElement = useCallback((element: HTMLElement) => {
        return element.matches(cancelableSelectors) || element.closest(cancelableSelectors);
    }, [cancelableSelectors]);

    const isFocusableElement = useCallback((element: HTMLElement) => {
        return element.matches(focusableSelectors) || element.closest(focusableSelectors);
    }, [focusableSelectors]);

    /**
     * Starts the drag operation by capturing the initial clientY position and resetting drag distance.
     * @param clientY - The Y coordinate of the pointer/touch when dragging starts.
     */
    const startDrag = useCallback((clientY: number) => {
        if (!isMobileDevice()) return;
        setIsDragging(true);
        setLastY(clientY);
        setTotalDragDistance(0);
        if (modalRef.current) {
            modalRef.current.style.transition = "";
            setInitialHeight(modalRef.current.clientHeight);
        }
    }, [modalRef]);

    /**
     * Handles the drag movement by calculating the new position and applying a transformation.
     * Ensures the modal can't be dragged above its initial position.
     * @param clientY - The current Y coordinate of the pointer/touch during dragging.
     */
    const onDrag = useCallback((clientY: number) => {
        if (!isMobileDevice()) return;
        if (modalRef.current == null || !isDragging || isClosed) return;
        const deltaY = clientY - lastY;
        setTotalDragDistance((prevDistance) => prevDistance + deltaY);

        // Ensure the sidebar doesn't move above its original position
        const newTranslateY = Math.min(Math.max(translateY + deltaY, 0), initialHeight);

        setTranslateY(newTranslateY);
        modalRef.current.style.transform = `translateY(${newTranslateY}px)`;
        setLastY(clientY);
    }, [isDragging, lastY, modalRef, translateY, initialHeight, isClosed]);

    /**
     * Closes the modal by moving it out of view.
     */
    const closeModal = useCallback((triggerOnClose: boolean) => {
        setIsClosed(true);
        if (triggerOnClose) {
            onClose?.();
        }
        if (modalRef.current) {
            modalRef.current.style.transition = "transform 100ms ease-out";
            modalRef.current.style.transform = `translateY(${initialHeight}px)`;
        }
    }, [modalRef, initialHeight, onClose]);

    /**
     * Ends the drag operation and decides whether to close the modal based on the swipe threshold.
     */
    const endDrag = useCallback(() => {
        if (!isMobileDevice()) return;
        setIsDragging(false);

        // Define a swipe-down threshold (e.g., 100px)
        const swipeThreshold = (modalRef?.current?.clientHeight ?? 256) / 4;

        if (totalDragDistance > swipeThreshold) {
            closeModal(true);
        } else if (translateY !== 0) {
            // Reset the sidebar position if it was dragged but not swiped enough
            setTranslateY(0);
            if (modalRef.current) {
                modalRef.current.style.transition = "transform 150ms ease-out";
                modalRef.current.style.transform = "translateY(0px)";
            }
        }
    }, [closeModal, modalRef, totalDragDistance, translateY]);

    /**
     * Opens the modal and resets its position.
     */
    const openModal = () => {
        setIsClosed(false);
        setTranslateY(0);
        if (modalRef.current) {
            modalRef.current.style.transform = "translateY(0px)";
        }
    };

    const onMouseDown = useCallback((e: MouseEvent) => {
        if (!isClosed) startDrag(e.clientY);
    }, [isClosed, startDrag]);

    const onMouseMove = useCallback((e: MouseEvent) => {
        onDrag(e.clientY);
    }, [onDrag]);

    const onTouchStart = useCallback<(e: TouchEvent) => void>((e) => {
        if (!isMobileDevice()) return;
        if (isCancelableElement(e.target as HTMLElement)) return;
        if (!isClosed) {
            if (!isFocusableElement(e.target as HTMLElement)) {
                e.preventDefault();
            }
            const touchY = e.touches[0].clientY;
            startDrag(touchY);
        }
    }, [isClosed, isCancelableElement, isFocusableElement, startDrag]);

    const onTouchMove = useCallback<(e: TouchEvent) => void>((e) => {
        if (!isMobileDevice()) return;
        if (isCancelableElement(e.target as HTMLElement)) return;
        if (!isFocusableElement(e.target as HTMLElement)) {
            e.preventDefault();
        }
        const touchY = e.touches[0].clientY;
        onDrag(touchY);
    }, [isCancelableElement, isFocusableElement, onDrag]);

    useEffect(() => {
        const element = modalRef.current;
        if (element) {
            element.addEventListener("touchstart", onTouchStart, { passive: false });
            element.addEventListener("touchmove", onTouchMove, { passive: false });
            element.addEventListener("touchend", endDrag);
            element.addEventListener("mousedown", onMouseDown);
            element.addEventListener("mousemove", onMouseMove);
            element.addEventListener("mouseup", endDrag);
        }
        return () => {
            if (!element) return;
            element.removeEventListener("touchstart", onTouchStart);
            element.removeEventListener("touchmove", onTouchMove);
            element.removeEventListener("touchend", endDrag);
            element.removeEventListener("mousedown", onMouseDown);
            element.removeEventListener("mousemove", onMouseMove);
            element.removeEventListener("mouseup", endDrag);
        };
    }, [endDrag, modalRef, onMouseDown, onMouseMove, onTouchMove, onTouchStart]);

    return {
        closeModal,
        isClosed,
        openModal,
    };
};
