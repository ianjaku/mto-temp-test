export interface CountdownModalProps {
    onCancel: () => void;
    onCountZero: () => void;
    startSeconds: number;
    modalTitle: string;
    modalMsgTranslationKey: string; /* requires "seconds" i18n prop */
    cancelLabel: string;
    countZeroLabel?: string;
}