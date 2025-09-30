import * as React from "react";
import { IThumbnail } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { Visual } from "@binders/client/lib/clients/imageservice/v1/Visual";
import { VisualModal } from "./VisualModal";

const { createContext, useContext, useState } = React;

export type VisualModalContext = {
    showVisualModal: (visual: Visual & IThumbnail, options?: { showDownloadButton?: boolean }) => void;
    openVisual: Visual & IThumbnail;
}

const context = createContext<VisualModalContext>({ openVisual: undefined, showVisualModal: undefined });

export const VisualModalContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [visual, setVisualSrc] = useState<Visual & IThumbnail | null>();
    const [isDisplayed, setIsDisplayed] = useState<boolean>();
    const [showDownloadButton, setShowDownloadButton] = useState<boolean>();
    const showVisualModal: VisualModalContext["showVisualModal"] = (visual, { showDownloadButton } = {}) => {
        setVisualSrc(visual);
        setShowDownloadButton(showDownloadButton);
        setIsDisplayed(true);
    };
    const hideVisualModal = () => {
        setVisualSrc(null);
        setIsDisplayed(false);
        setShowDownloadButton(false);
    }

    return (
        <context.Provider value={{ showVisualModal, openVisual: visual }}>
            {
                isDisplayed ?
                    <VisualModal
                        visual={visual}
                        onHide={hideVisualModal}
                        showDownloadButton={showDownloadButton}
                    /> :
                    null
            }
            {children}
        </context.Provider>
    )
}

export function useVisualModal(): VisualModalContext {
    const ctx = useContext(context);
    if (!ctx.showVisualModal) {
        throw new Error("useVisualModal was used, but VisualModalContextProvider was not initialized. Make sure it exists in the hierarchy above and all properties are set.");
    }
    return ctx;
}

