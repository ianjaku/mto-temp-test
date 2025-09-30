import React, { Fragment, useCallback, useMemo, useState } from "react";
import { getHightlightLeftPosition, getSubToolbarWidth } from "../helpers";
import { navigateToBrowsePath, navigateToHome, switchToLauncher } from "../../../../navigation";
import {
    useActiveParentCollection,
    useParentPath,
    useParentTitle
} from "../../../../stores/hooks/binder-hooks";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { ToolbarTooltip } from "../ToolbarTooltip";
import cx from "classnames";
import { isReadPath } from "../../../../util";
import manualtoVars from "../../../../vars.json";
import { unloadPublication } from "../../../../binders/binder-loader";
import { useCurrentDocumentIndex } from "./useCurrentDocumentIndex";
import { useHistory } from "react-router";

interface Props {
    invisible?: boolean;
}

export const ToolbarNavigation: React.FC<Props> = (props) => {

    const activeParentCollection = useActiveParentCollection();
    const history = useHistory();
    const parentPath = useParentPath();
    const parentTitle = useParentTitle();

    const [visibleTooltip, setVisibleTooltip] = useState<string | null>(null);

    const parentCollectionItems = useMemo(() => {
        return activeParentCollection?.items.toArray();
    }, [activeParentCollection]);

    const currentDocumentIndex = useCurrentDocumentIndex(parentCollectionItems);

    const [previousItem, nextItem] = useMemo(() => {
        if (!parentCollectionItems) {
            return [null, null];
        }
        return [
            parentCollectionItems[currentDocumentIndex - 1],
            parentCollectionItems[currentDocumentIndex + 1],
        ];
    }, [currentDocumentIndex, parentCollectionItems]);

    const maxDocumentIndex = parentCollectionItems?.length - 1;
    const shouldDisplayBack = previousItem && currentDocumentIndex !== undefined && currentDocumentIndex > 0;
    const shouldDisplayForward = nextItem && maxDocumentIndex !== 0 && currentDocumentIndex !== maxDocumentIndex;
    const shouldDisplayUp = !!(parentPath?.length);
    const shouldNavigateHome = isReadPath(history.location.pathname);

    const navigate = useCallback((direction: "back" | "fwd" | "up" | "home") => {
        unloadPublication();
        if (direction === "home") {
            navigateToHome();
            return;
        }
        if (direction === "up") {
            navigateToBrowsePath(history, parentPath);
            return;
        }
        switchToLauncher(history, direction === "back" ? previousItem : nextItem);
    }, [history, nextItem, parentPath, previousItem]);

    const [hoveredButtonIndex, setHoveredButtonIndex] = useState<number | null>(null);

    const buttonDefs = useMemo(() => {
        return [
            ...(shouldDisplayBack ?
                [{
                    id: "back",
                    onClick: () => navigate("back"),
                    icon: "arrow_back",
                    tooltip: previousItem ? previousItem.title : undefined,
                }] :
                []),
            ...(shouldDisplayUp ?
                [{
                    id: "up",
                    onClick: () => navigate(shouldNavigateHome ? "home" : "up"),
                    icon: "home",
                    tooltip: parentTitle,
                }] :
                []),
            ...(shouldDisplayForward ?
                [{
                    id: "forward",
                    onClick: () => navigate("fwd"),
                    icon: "arrow_forward",
                    tooltip: nextItem ? nextItem.title : undefined,
                }] :
                []),
        ];
    }, [navigate, nextItem, parentTitle, previousItem, shouldDisplayBack, shouldNavigateHome, shouldDisplayForward, shouldDisplayUp]);


    const btnCount = buttonDefs.length;
    const width = props.invisible ? 0 : getSubToolbarWidth(btnCount);

    if (!btnCount) {
        return null;
    }
    return (
        <div
            className={cx("toolbarPill", "toolbarNavigation", { "toolbarNavigation--invisible": props.invisible })}
            style={{ width, marginLeft: !!width && manualtoVars.toolbarGap }}
        >
            {hoveredButtonIndex !== null && (
                <div
                    className="toolbarNavigation-highlight"
                    style={
                        (hoveredButtonIndex === btnCount - 1) ?
                            { right: 0 } :
                            { left: getHightlightLeftPosition(hoveredButtonIndex) }
                    }
                ></div>
            )}
            <div className="toolbarSpacer"></div>
            <div className={cx(
                "toolbarButtons",
                buttonDefs.length === 1 ? "justify-center" : "justify-between",
            )}>
                {buttonDefs.map((btnDef, index) => (
                    <Fragment key={`tbn-btn${index}`}>
                        <div
                            onClick={btnDef.onClick}
                            className="toolbarButtons-button"
                            onMouseEnter={() => { setHoveredButtonIndex(index); setVisibleTooltip(btnDef.id); }}
                            onMouseLeave={() => { setHoveredButtonIndex(null); setVisibleTooltip(null); }}
                        >
                            <Icon name={btnDef.icon} />
                        </div>
                        {visibleTooltip === btnDef.id && (
                            <ToolbarTooltip
                                message={btnDef.tooltip}
                                rightAnchor
                            />
                        )}
                    </Fragment>
                ))}
            </div>
            <div className="toolbarSpacer"></div>
        </div>
    )
}
