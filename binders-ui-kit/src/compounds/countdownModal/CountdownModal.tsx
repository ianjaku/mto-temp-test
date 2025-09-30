import * as React from "react";
import Button from "../../elements/button";
import { CountdownModalProps } from "@binders/client/lib/react/countdown/contract";
import Modal from "../../elements/modal";
import { TFunction } from "@binders/client/lib/i18n";
import { useTranslation } from "@binders/client/lib/react/i18n";

const { useCallback, useRef, useEffect, useState } = React;

const CountdownModal: React.FC<CountdownModalProps> = ({
    onCancel,
    onCountZero,
    startSeconds,
    modalTitle,
    modalMsgTranslationKey,
    cancelLabel,
    countZeroLabel,
}) => {
    const [countDownDelta, setCountdownDelta] = useState(0);
    const [countDownStart] = useState(new Date().getTime());
    const intervalId = useRef(null);
    const { t }: { t: TFunction } = useTranslation();

    const doCountDown = useCallback(() => {
        const now = new Date().getTime();
        const delta = Math.floor((now - countDownStart) / 1000);
        if (delta >= startSeconds) {
            clearInterval(intervalId.current);
            onCountZero();
        } else {
            setCountdownDelta(delta);
        }
    }, [countDownStart, onCountZero, startSeconds]);

    const startCountDown = useCallback(() => {
        if (intervalId.current) {
            return;
        }
        intervalId.current = setInterval(doCountDown, 1000);
    }, [doCountDown]);

    const stopCountDown = useCallback(() => {
        if (intervalId.current) {
            clearInterval(intervalId.current);
            intervalId.current = null;
        }
    }, []);

    useEffect(() => {
        startCountDown();
        return () => {
            stopCountDown();
        };
    }, [startCountDown, stopCountDown]);

    return (
        <Modal
            title={modalTitle}
            buttons={[
                ...(countZeroLabel ?
                    [
                        <Button text={countZeroLabel} onClick={onCountZero} secondary={true} />,
                    ] :
                    []),
                <Button text={cancelLabel} onClick={onCancel} />,
            ]}
            onHide={onCancel}
        >
            <p>
                {t(modalMsgTranslationKey, { seconds: (startSeconds - countDownDelta) })}
            </p>
        </Modal>
    );
}

export default CountdownModal;
