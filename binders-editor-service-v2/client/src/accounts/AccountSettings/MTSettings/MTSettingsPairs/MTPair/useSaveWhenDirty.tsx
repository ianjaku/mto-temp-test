import { useEffect } from "react";

export default function useSaveWhenDirty(
    isDirty: boolean,
    validateForm: () => boolean,
    setIsDirty: (d: boolean) => void,
    onSave: () => void,
): void {
    useEffect(() => {
        if (isDirty) {
            if (validateForm()) {
                onSave();
            }
            setIsDirty(false);
        }
    })
}