import { isMobilePortraitView } from "@binders/ui-kit/lib/helpers/rwd"
import { useEffect } from "react";

export const useAutoOpenSettings = (
    isOpen: boolean,
    setIsOpen: (isOpen: boolean) => unknown,
) => {
    useEffect(() => {
        if (isOpen) return;
        if (!isMobilePortraitView()) {
            setIsOpen(true);
        }
    }, [isOpen, setIsOpen]);
}