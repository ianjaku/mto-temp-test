import * as React from "react";
import {
    EditorItem,
    InheritedSettingsItem,
    ItemConfigAccessType,
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { FC, useCallback, useEffect, useState } from "react";
import Modal, { ModalWidth } from "@binders/ui-kit/lib/elements/modal";
import {
    UpdateReaderFeedbackConfigParams,
    useReaderFeedbackConfigMutation,
} from "../../documents/hooks";
import Button from "@binders/ui-kit/lib/elements/button";
import { ModalProps } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import ReaderFeedbackSettings from "../ReaderFeedbackSettings/ReaderFeedbackSettings";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { extractTitle } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { isCollectionItem } from "@binders/client/lib/clients/repositoryservice/v3/validation";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./ReaderFeedbackSettingsModal.styl"

export const ReaderFeedbackSettingsModal: FC<
    ModalProps<{ initialItem: EditorItem }, undefined>
> = ({
    params,
    hide,
}) => {
    const { t } = useTranslation();
    const [updateParams, setUpdateParams] = useState<UpdateReaderFeedbackConfigParams>();
    const [shouldHide, setShouldHide] = useState(true);
    const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);
    const [item, setItem] = useState((): InheritedSettingsItem => ({
        id: params.initialItem.id,
        title: extractTitle(params.initialItem),
        isCollection: isCollectionItem(params.initialItem),
        access: ItemConfigAccessType.EDITABLE,
    }));
    const [currentItem, setCurrentItem] = useState<InheritedSettingsItem>();
    const [itemHistory, setItemHistory] = useState<InheritedSettingsItem[]>([]);

    const goToItem = (item: InheritedSettingsItem) => {
        setCurrentItem(item);
        setItem(item);
        setItemHistory([...itemHistory, currentItem]);
        setShouldHide(false);
    }
    const goBack = () => {
        if (!itemHistory.length) return
        const lastItem = itemHistory.pop();
        setCurrentItem(lastItem);
        setItem(lastItem);
        setItemHistory([...itemHistory]);
        if (itemHistory.length === 0) setShouldHide(true);
    }

    const {
        mutate: updateReaderFeedbackConfig,
        isSuccess: isSuccessfulConfigUpdate,
        isLoading: isUpdatingConfig,
    } = useReaderFeedbackConfigMutation();

    const save = useCallback(() => {
        if (updateParams) {
            updateReaderFeedbackConfig(updateParams);
        }
    }, [updateParams, updateReaderFeedbackConfig]);

    const onHide = useCallback(() => {
        const canHide = updateParams == null;
        if (canHide) {
            hide();
            return true;
        }
        setIsConfirmingDiscard(true);
        return false;
    }, [hide, updateParams]);

    useEffect(() => {
        if (isSuccessfulConfigUpdate) {
            setUpdateParams(null);
            if (shouldHide) hide();
        }
    }, [hide, isSuccessfulConfigUpdate, shouldHide]);

    return (
        <Modal
            buttons={isConfirmingDiscard ?
                [
                    <Button
                        text={t(TK.General_DiscardChanges)}
                        secondary
                        onClick={() => {
                            setUpdateParams(undefined)
                            hide();
                        }}
                    />,
                    <Button
                        text={t(TK.General_KeepEditing)}
                        onClick={() => {
                            setIsConfirmingDiscard(false)
                        }}
                    />
                ] :
                [
                    <Button
                        text={itemHistory.length ? t(TK.General_GoBack) : t(TK.General_Cancel)}
                        secondary
                        onClick={itemHistory.length ? goBack : onHide}
                        inactiveWithLoader={isUpdatingConfig}
                    />,
                    <Button
                        text={t(TK.General_Save)}
                        onClick={save}
                        isEnabled={updateParams != null}
                        inactiveWithLoader={isUpdatingConfig}
                    />
                ]
            }
            classNames="readerfeedbackSettingsModal"
            modalWidth={ModalWidth.Medium1}
            noCloseIcon={isConfirmingDiscard}
            onHide={onHide}
            title={isConfirmingDiscard ?
                t(TK.ReaderFeedback_Setting_DiscardChangesConfirmTitle) :
                t(TK.ReaderFeedback_Setting_Title, { title: item.title })
            }
        >
            {isConfirmingDiscard ?
                <p className="readerfeedbackSettingsModal-confirm">
                    {t(TK.General_DiscardChangesConfirmBody)}
                </p> :
                <ReaderFeedbackSettings
                    currentItem={currentItem}
                    item={item}
                    goToItem={goToItem}
                    setCurrentItem={setCurrentItem}
                    setUpdateParams={setUpdateParams}
                    updateParams={updateParams}
                />
            }
        </Modal>
    );
}
