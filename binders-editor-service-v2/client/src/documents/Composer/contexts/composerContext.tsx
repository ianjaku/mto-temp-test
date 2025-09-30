import * as React from "react";
import { VisualModalContext, useVisualModal } from "../../../media/VisualModal";
import { NavigationDrawerPaneItem } from "../components/NavigationDrawer";
import { VisualAbstract } from "@binders/client/lib/clients/imageservice/v1/Visual";
import { useBinderVisuals } from "../../../media/binder-media-store";
import { useMemo } from "react";

export type ComposerContextType = {
    hasContext: boolean; // False if there is no parent context provider
    openVisual: VisualAbstract;
    setOpenVisual: VisualModalContext["showVisualModal"];
    focusedVisualId: string;
    setFocusedVisualId: (visual: string) => void;
    canAdmin: boolean;
    setCanAdmin: (canAdmin: boolean) => void;
    disableChunkPointerEvents: boolean;
    setDisableChunkPointerEvents: (visible: boolean) => void;
    hasHorizontalVisuals?: boolean;
    setHasHorizontalVisuals: (h: boolean) => void;
    chunkImagesBumpable?: number;
    bumpChunkImagesBumpable: () => void;
    hoveredThumbnailId?: string;
    setHoveredThumbnailId: (id: string) => void;
    navigationDrawerItem: NavigationDrawerPaneItem;
    setNavigationDrawerItem: (index: NavigationDrawerPaneItem) => void;
};

export const ComposerContext = React.createContext<ComposerContextType>({
    hasContext: false,
    openVisual: undefined,
    setOpenVisual: () => undefined,
    focusedVisualId: undefined,
    setFocusedVisualId: () => undefined,
    canAdmin: undefined,
    setCanAdmin: () => undefined,
    disableChunkPointerEvents: undefined,
    setDisableChunkPointerEvents: () => undefined,
    setHasHorizontalVisuals: () => undefined,
    bumpChunkImagesBumpable: () => undefined,
    setHoveredThumbnailId: () => undefined,
    setNavigationDrawerItem: () => undefined,
    navigationDrawerItem: undefined
});

type Props = {
    children: React.ReactNode;
};

export const ComposerContextProvider: React.FC = ({ children }: Props) => {
    const { openVisual, showVisualModal: setOpenVisual } = useVisualModal();
    const storeVisuals = useBinderVisuals();
    const storeVisual = useMemo(() => {
        const storeVisual = storeVisuals.find(v => v.id === openVisual?.id);
        return storeVisual ?? openVisual;
    }, [storeVisuals, openVisual]);
    const [canAdmin, setCanAdmin] = React.useState<boolean>(undefined);
    const [focusedVisualId, setFocusedVisualId] = React.useState<string>(undefined);
    const [disableChunkPointerEvents, setDisableChunkPointerEvents] = React.useState<boolean>(false);
    const [hasHorizontalVisuals, setHasHorizontalVisuals] = React.useState<boolean>(undefined);
    const [chunkImagesBumpable, setChunkImagesBumpable] = React.useState<number>(0);
    const bumpChunkImagesBumpable = () => setChunkImagesBumpable(b => b + 1);
    const [hoveredThumbnailId, setHoveredThumbnailId] = React.useState<string>();
    const [navigationDrawerItem, setNavigationDrawerItem] = React.useState<number>(null);

    return (
        <ComposerContext.Provider
            value={{
                hasContext: true,
                openVisual: storeVisual,
                setOpenVisual,
                focusedVisualId,
                setFocusedVisualId,
                canAdmin,
                setCanAdmin,
                disableChunkPointerEvents,
                setDisableChunkPointerEvents,
                hasHorizontalVisuals,
                setHasHorizontalVisuals,
                chunkImagesBumpable,
                bumpChunkImagesBumpable,
                hoveredThumbnailId,
                setHoveredThumbnailId,
                navigationDrawerItem,
                setNavigationDrawerItem
            }}
        >
            {children}
        </ComposerContext.Provider>
    );
};

export const useComposerContext = (): ComposerContextType => React.useContext(ComposerContext);
