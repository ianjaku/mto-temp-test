import * as React from "react";
import { useCallback, useState } from "react";
import Button from "@binders/ui-kit/lib/elements/button";
import Input from "@binders/ui-kit/lib/elements/input";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";

const EditUsergroup = (props: {
    onHide: () => void;
    onSave: (groupName: string) => Promise<void>;
    group?: { id: string; name?: string; };
}) => {
    const { group, onHide, onSave } = props;
    const [groupName, setGroupName] = useState(group?.name ?? "");
    const { t } = useTranslation();

    const onClickSave = useCallback(async () => {
        await onSave(groupName);
        onHide();
    }, [groupName, onHide, onSave]);

    const title = group ? t(TK.User_EditUserGroup) : t(TK.User_CreateUserGroup);

    return (
        <Modal
            title={title}
            onHide={onHide}
            buttons={[
                <Button
                    key="done"
                    isEnabled={groupName?.trim().length > 0}
                    text={t(TK.General_Save)}
                    onClick={onClickSave}
                />
            ]}
            onEnterKey={onClickSave}
            onEscapeKey={onHide}
        >
            <Input
                placeholder={t(TK.User_UsegroupName)}
                onChange={value => setGroupName(value)}
                value={groupName}
            />
        </Modal>
    );
}

export default EditUsergroup;
