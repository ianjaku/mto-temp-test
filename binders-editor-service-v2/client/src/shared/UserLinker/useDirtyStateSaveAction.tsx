import { DirtyStateId, useDirtyStateContext } from "../DirtyStateContext";
import { useCallback, useEffect } from "react";
import {
    ConfirmModal
} from "../../notification/settings/sections/create-notification-modal/ConfirmModal";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useShowModal } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { useTranslation } from "@binders/client/lib/react/i18n";

export function useDirtyStateSaveAction(
    saveActionTriggered: boolean,
    saveAction: () => Promise<void>,
    skip = false,
): void {
    const { registerDirtyStateHandler, unregisterDirtyStateHandler } = useDirtyStateContext();
    const confirmSave = useShowModal(ConfirmModal, "confirmSave");
    const { t } = useTranslation();

    const dirtyStateHandler = useCallback(async () => {
        if (skip || !saveActionTriggered) {
            return;
        }
        const shouldSave = await confirmSave({
            title: t(TK.General_SaveChanges),
            message: t(TK.User_DeviceUserTargetSaveSelected),
            zIndexBump: 5,
        });
        if (shouldSave) {
            await saveAction();
        }
    }, [saveActionTriggered, confirmSave, saveAction, t, skip]);

    useEffect(() => {
        if (skip) {
            return;
        }
        registerDirtyStateHandler(DirtyStateId.deviceUserTargets, dirtyStateHandler);
        return () => {
            unregisterDirtyStateHandler(DirtyStateId.deviceUserTargets);
        }
    }, [saveActionTriggered, dirtyStateHandler, registerDirtyStateHandler, unregisterDirtyStateHandler, skip]);

}