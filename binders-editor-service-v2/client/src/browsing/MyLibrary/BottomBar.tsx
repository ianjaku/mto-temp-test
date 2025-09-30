import * as React from "react";
import { AddNewButtonModals, useAddNewButton } from "./AddNewButton";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { useActiveBinder } from "../../documents/hooks";
import { useActiveCollection } from "../hooks";
import { useActiveItem } from "../../shared/hooks/useActiveItem";
import { useBrowseShareButton } from "../../shared/hooks/useBrowseShareButton";
import { useOpenReaderWindow } from "../../shared/hooks/useOpenReaderWindow";
import { usePublishedUnpublishedLanguages } from "../../documents/Composer/hooks/usePublishedUnpublishedLangCodes";
import { useRef } from "react";
import { useRouteMatch } from "react-router";
import "./BottomBar.styl";

export const BottomBar = () => {
    const item = useActiveItem();
    const activeCollection = useActiveCollection();
    const { onClick: onBrowseShareButtonClick } = useBrowseShareButton({ item });
    const openReaderWindow = useOpenReaderWindow({ collection: activeCollection });
    const addNewButtonProps = useAddNewButton();
    const createButtonRef = useRef(null);
    const isInMyLibrary = activeCollection != null;

    return (
        <>
            <div className="bottomBar">
                {isInMyLibrary && !item?.isRootCollection && <button onClick={onBrowseShareButtonClick}><Icon name="qr_code" /></button>}
                {isInMyLibrary && <button onClick={openReaderWindow}><Icon name="chrome_reader_mode" /></button>}
                <button
                    ref={createButtonRef}
                    onClick={addNewButtonProps.toggleMenuOpen}
                ><Icon name="add" /></button>
            </div>
            <AddNewButtonModals
                anchorRef={createButtonRef.current}
                {...addNewButtonProps}
            />
        </>
    )
}

export function useIsBottomBarVisible() {
    const binder = useActiveBinder();
    const { publishedLanguages } = usePublishedUnpublishedLanguages(binder);
    const routeMatch = useRouteMatch();
    return routeMatch.path.startsWith("/documents") ? publishedLanguages.length > 0 : true;
}
