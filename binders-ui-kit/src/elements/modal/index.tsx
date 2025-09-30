import * as React from "react";
import { RwdRecord, isMobileView } from "../../helpers/rwd";
import { isEnterPressed, isEscapePressed } from "../../helpers/helpers";
import { useEffect, useMemo, useRef, useState } from "react";
import ModalBody from "./ModalBody";
import ModalFooter from "./ModalFooter";
import ModalHeader from "./ModalHeader";
import cx from "classnames";
import { useExtensionPullDownToDismiss } from "../../hooks/useExtensionPullDownToDismiss";
import useFlyInEffect from "./useFlyInEffect";
import { usePullDownToDismiss } from "../../hooks/usePullDownToDismiss";
import vars from "../../variables";
import "./modal.styl";

export interface StretchOption {
    allowShrink?: boolean;
    doStretch: boolean;
    maxTopGap?: number;
    minTopGap?: number;
}

export interface MobileViewOptions {
    flyFromBottom?: boolean;
    pulldownToDismiss?: boolean;
    stretchX?: StretchOption;
    stretchY?: StretchOption;
}

export enum ModalWidth {
    FitContent = "fitContent",
    Medium1 = "medium1",
    Narrow = "narrow",
    Wide = "wide",
}

export enum ModalBodyPadding {
    Default = "default",
    None = "none",
    Medium = "medium",
}

const noop = (e: React.MouseEvent) => e.stopPropagation();

interface IModalProps {
    additionalHeaderChildren?: Array<{ element: React.ReactElement, additionalClassName?: string }>;
    buttons?: Array<React.ReactElement>;
    children?: React.ReactNode;
    classNames?: string;
    closeIcon?: React.ReactElement;
    extension?: React.ReactElement;
    headerColor?: string;
    hidden?: boolean;
    mobileViewOptions?: MobileViewOptions;
    modalWidth?: ModalWidth;
    noCloseIcon?: boolean;
    onEnterKey?: () => void;
    onEscapeKey?: () => void;
    onExtensionDismiss?: () => void;
    onHide?: () => void | boolean;
    showExtension?: boolean;
    title?: string;
    titleHtml?: RwdRecord;
    uncloseable?: boolean;
    withBodyEl?: (bodyEl: HTMLDivElement) => React.ReactNode;
    // Hide the dark overlay behind the modal
    withoutBg?: boolean;
    withoutFooter?: boolean;
    withoutHeader?: boolean;
    withoutHeaderPadding?: boolean;
    withoutPadding?: boolean;
    zIndexBump?: number;
    modalBodyPadding?: ModalBodyPadding;
}

const Modal: React.FC<IModalProps> = ({
    additionalHeaderChildren,
    buttons,
    children,
    classNames,
    closeIcon,
    extension,
    headerColor,
    hidden,
    mobileViewOptions,
    modalWidth,
    noCloseIcon,
    onEnterKey,
    onEscapeKey,
    onExtensionDismiss,
    onHide,
    showExtension,
    title,
    titleHtml,
    uncloseable,
    withBodyEl,
    withoutBg,
    withoutFooter,
    withoutHeader,
    withoutHeaderPadding,
    withoutPadding,
    zIndexBump,
    modalBodyPadding,
}) => {

    const [visible, setVisible] = useState(false);
    const modalWrapperRef = useRef(null);
    const modalRef = useRef(null);
    const timestampOnMount = useRef(null);
    const dragHandleRef = useRef(null);
    const extensionRef = useRef(null);
    const extensionDragHandleRef = useRef(null);
    const modalWrapperExtensionRef = useRef(null);

    useEffect(() => {
        setVisible(hidden === undefined ? true : !hidden);
    }, [hidden]);

    useEffect(() => {
        timestampOnMount.current = Date.now();
        const activateInputTimeout = setTimeout(
            () => modalWrapperRef?.current &&
                document.activeElement.tagName.toLowerCase() !== "input" &&
                modalWrapperRef.current.focus(),
            800
        );
        return () => {
            clearTimeout(activateInputTimeout);
        };
    }, []);

    const close = (e) => {
        e.stopPropagation?.();
        if (uncloseable) {
            return;
        }
        if (!timestampOnMount.current || Date.now() - timestampOnMount.current < 100) {
            return;
        }
        let hideInterrupted;
        if (onHide) {
            hideInterrupted = onHide() === false;
        }
        if (!hideInterrupted) {
            setVisible(false);
        }
    };

    const onKeyDown = (e) => {
        if (isEnterPressed(e) && typeof onEnterKey === "function") {
            onEnterKey();
        } else if (isEscapePressed(e) && typeof onEscapeKey === "function") {
            onEscapeKey();
        }
    };

    const classes = cx(
        "modal-wrapper",
        classNames ? classNames : undefined,
        withoutBg ? "modal-wrapper--noBg" : undefined,
    );

    const { modalStyle, flyout } = useFlyInEffect(mobileViewOptions);
    const onDismiss = async () => {
        try {
            await flyout();
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err);
        } finally {
            onHide?.();
        }
    }
    usePullDownToDismiss(modalRef.current, dragHandleRef.current, onDismiss, mobileViewOptions);
    useExtensionPullDownToDismiss(modalWrapperExtensionRef, extensionDragHandleRef, onExtensionDismiss || (() => { }), showExtension, mobileViewOptions);

    const bodyPadding = useMemo(() => {
        if (withoutPadding) {
            return ModalBodyPadding.None;
        }
        return modalBodyPadding || ModalBodyPadding.Default;
    }, [withoutPadding, modalBodyPadding]);

    if (!visible) {
        return null;
    }

    return (
        <div
            tabIndex={0}
            ref={modalWrapperRef}
            className={classes}
            onMouseDown={close}
            onKeyDown={onKeyDown}
            style={{
                zIndex: 1400 + (zIndexBump || 0),
                ...(mobileViewOptions?.stretchY && isMobileView() ? { alignItems: "flex-end" } : {}),
            }}

        >
            <div
                className={cx("modal-wrapper-extension", { "modal-wrapper-extension--showExtension": showExtension })}
                ref={modalWrapperExtensionRef}
                onMouseDown={noop}
                style={{
                    ...(isMobileView() && mobileViewOptions?.stretchX?.doStretch ?
                        {
                            width: "100vw",
                        } :
                        {}),
                    ...(isMobileView() && mobileViewOptions?.stretchY?.doStretch ?
                        {
                            ...(mobileViewOptions.stretchY.allowShrink ?
                                {
                                    maxHeight: `calc(100vh - ${mobileViewOptions.stretchY.minTopGap || 0}px)`,
                                    minHeight: mobileViewOptions.stretchY.maxTopGap ? `calc(100vh - ${mobileViewOptions.stretchY.maxTopGap}px)` : undefined,
                                } :
                                {
                                    height: "100vh",
                                }),
                        } :
                        {}),
                    ...modalStyle,
                }}
            >
                <div
                    className={cx("modal", `modal--${modalWidth}`)}
                    ref={modalRef}
                    onMouseDown={noop}
                >
                    <div
                        className="modal-dragHandle"
                        ref={dragHandleRef}
                        style={{ visibility: isMobileView() && mobileViewOptions?.pulldownToDismiss ? "visible" : "hidden" }}
                    >
                        <svg width="38" height="3" viewBox="0 0 38 3" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="38" height="3" rx="1.5" fill={vars.grey600} /></svg>
                    </div>
                    {!withoutHeader && <ModalHeader
                        additionalHeaderChildren={additionalHeaderChildren}
                        closeIcon={closeIcon}
                        color={headerColor}
                        noCloseIcon={noCloseIcon}
                        onClose={close}
                        title={title}
                        titleHtml={titleHtml}
                        uncloseable={uncloseable}
                        withoutPadding={withoutHeaderPadding}
                    />}
                    <ModalBody bodyPadding={bodyPadding} withBodyEl={(bodyEl) => (
                        <>
                            {withoutHeader && closeIcon && (
                                <button onClick={close} className="modal-closeBtn">
                                    {closeIcon}
                                </button>
                            )}
                            {children && children}
                            {withBodyEl && withBodyEl(bodyEl)}
                        </>
                    )} />
                    {!withoutFooter && buttons && (
                        <>
                            <ModalFooter buttons={buttons} />
                            <div className="modal-filler"></div> {/* This is needed to make the modal footer stick to the bottom */}
                        </>
                    )}
                </div>
                <div className="modal-extension" ref={extensionRef}>
                    <div
                        className="modal-extension-dragHandle"
                        ref={extensionDragHandleRef}
                    >
                        <svg width="38" height="3" viewBox="0 0 38 3" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="38" height="3" rx="1.5" fill={vars.grey500} /></svg>
                    </div>
                    {extension}
                </div>
            </div>
        </div>
    )
}

export default Modal;
