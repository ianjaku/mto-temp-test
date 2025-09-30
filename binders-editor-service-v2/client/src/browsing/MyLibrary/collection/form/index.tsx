import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import Button from "@binders/ui-kit/lib/elements/button";
import { FlashMessages } from "../../../../logging/FlashMessages";
import Input from "@binders/ui-kit/lib/elements/input";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";
import WiredTreeNavigator from "../../../WiredTreeNavigator";
import classnames from "classnames";
import { createCollection } from "../../../../documents/tsActions";
import { generatePathFromCollectionIds } from "../../../helper";
import { trimSlashes } from "@binders/client/lib/util/uri";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./collectionForm.styl";

export interface IAddNewCollectionProps {
    accountId: string;
    defaultLanguageSettings: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    history: any;
    open: boolean;
    parentCollectionId: string;
    parentItems: Array<{ id: string; name: string; }>;
    onClose: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    routingParams: any;
}

interface ICollectionOption {
    name: string;
    language: string;
}

const AddNewCollectionForm: React.FunctionComponent<IAddNewCollectionProps> = (props) => {
    const { t }: { t: TFunction } = useTranslation();
    const {
        accountId,
        defaultLanguageSettings,
        history,
        onClose,
        open,
        parentCollectionId,
        parentItems,
        routingParams,
    } = props;

    const defaultCollection = { name: "", language: defaultLanguageSettings || UNDEFINED_LANG };

    const [isCreating, setIsCreating] = useState(false);

    const [selectedCollectionId, setSelectedCollectionId] = useState(undefined);
    const [selectedCollectionParentPath, setSelectedCollectionParentPath] = useState(undefined);
    const [isFormValid, setIsFormValid] = useState(false);
    const [showValidFormMessage, setShowValidFormMessage] = useState(false);
    const [collectionOption, setCollectionOption] = useState(defaultCollection);

    const checkIsFormValid = (collectionOption: ICollectionOption) => {
        if (collectionOption.name === "") {
            setIsFormValid(false);
        } else {
            setIsFormValid(true);
        }
    };

    // If collection options change, we validate
    useEffect(() => {
        checkIsFormValid(collectionOption);
    }, [collectionOption]);

    const onChangeCollectionName = useCallback((value: string) => {
        const newOptions = { ...collectionOption, name: value };
        setCollectionOption(newOptions);
    }, [collectionOption]);

    const onSelectTreeItem = (
        collectionId: string,
        _: string,
        collectionParentPath: string[],
    ) => {
        setSelectedCollectionId(collectionId);
        setSelectedCollectionParentPath(collectionParentPath);
    };

    const onCreateCollection = async () => {
        if (!isFormValid) {
            return setShowValidFormMessage(true);
        }

        try {
            setIsCreating(true);
            const collection = await createCollection(
                accountId,
                collectionOption.name,
                collectionOption.language,
                selectedCollectionId || parentCollectionId,
            );
            const path = selectedCollectionParentPath ?
                `${selectedCollectionParentPath.join("/")}/${selectedCollectionId}` :
                generatePathFromCollectionIds(routingParams);
            history.push(`/browse/${trimSlashes(path)}/${collection.id}`);
            FlashMessages.success(t(TK.DocManagement_ColCreateSuccess));
        }
        catch (e) {
            FlashMessages.error(t(TK.DocManagement_ColCreateFail))
        }
        finally {
            setIsCreating(false);
            onClose();
        }
    };

    return !open ?
        <div /> :
        (
            <div className={classnames("collectionForm-cover", { "is-invalid": !isFormValid })}>
                <Modal
                    title={t(TK.DocManagement_ColNew)}
                    onHide={onClose}
                    buttons={[
                        <Button
                            key="done"
                            text={t(TK.General_SetItUp)}
                            onClick={onCreateCollection}
                            inactiveWithLoader={isCreating}
                            isEnabled={isFormValid && selectedCollectionId}
                        />
                    ]}
                    classNames="collectionForm-modal"
                    onEnterKey={onCreateCollection}
                    onEscapeKey={onClose}
                >
                    <div className="collectionForm">
                        <div className="collectionForm-header">
                            <p>{t(TK.General_Name)}</p>
                        </div>
                        <Input
                            type="text"
                            name="name"
                            className="collectionForm-control"
                            placeholder={t(TK.DocManagement_ColName)}
                            onChange={onChangeCollectionName}
                        />
                        {showValidFormMessage && !isFormValid && (
                            <p className="collectionForm-modal-tip collectionForm-modal-tip--warning">
                                {t(TK.Exception_MissingFields2)}
                            </p>
                        )}
                    </div>
                    <p className="newDocument-modal-tip">
                        {t(TK.DocManagement_ColNewChooseCol)}:
                    </p>
                    <WiredTreeNavigator
                        parentItems={parentItems}
                        onSelect={onSelectTreeItem}
                        allowRootSelection={true}
                    />
                </Modal>
            </div>
        );
}

export default AddNewCollectionForm;
