import React, { useRef } from "react";
import Close from "@binders/ui-kit/lib/elements/icons/Close";
import useFlyInEffect from "./useFlyInEffect";
import { useOutsideClick } from "@binders/client/lib/react/helpers/useOutsideClick";
import { usePullDownToDismiss } from "@binders/ui-kit/lib/hooks/usePullDownToDismiss";
import vars from "@binders/ui-kit/lib/variables";
import "./ReaderModal.styl";

interface Props {
    children: React.ReactNode;
    onRequestHide: () => void;
}

const ReaderModal: React.FC<Props> = (props: Props) => {

    const modalRef = useRef<HTMLDivElement>(null);
    const dragHandleRef = useRef<HTMLDivElement>(null);

    const { modalStyle, flyout } = useFlyInEffect();

    const onDismiss = async () => {
        await flyout();
        props.onRequestHide();
    }

    const clickOutsideRef = useOutsideClick<HTMLDivElement>(onDismiss);
    usePullDownToDismiss(modalRef.current, dragHandleRef.current, onDismiss);

    return (
        <div className="readerModal-wrapper">
            <div className="readerModal" ref={modalRef} style={modalStyle}>
                <label className="readerModal-close" onClick={props.onRequestHide}>
                    <Close />
                </label>
                <div ref={clickOutsideRef}>
                    <div className="readerModal-dragHandle" ref={dragHandleRef}>
                        <svg width="38" height="3" viewBox="0 0 38 3" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="38" height="3" rx="1.5" fill={vars.grey600} /></svg>
                    </div>
                    <div className="readerModal-content">
                        {props.children}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ReaderModal;
