import * as React from "react";
import Button from "@binders/ui-kit/lib/elements/button";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";
import WiredTreeNavigator from "../../WiredTreeNavigator";
import classnames from "classnames";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./AddNewDocument.styl";

const { useState, useEffect } = React;

interface IAddNewDocumentProps {
    parentItems: Array<{ id: string, name: string }>,
    defaultLanguageSettings: string,
    onAddNewDocument: (colId: string, paprentPath: string[], lang: string) => void,
    onModalHide: () => void,
    onClose: (selectedCollectionId: string, selectedCollectionParentPath: string, selectedLanguage: string) => Promise<void>,
}

const AddNewDocument: React.FC<IAddNewDocumentProps> = (props: IAddNewDocumentProps) => {
    const { t }: { t: TFunction } = useTranslation();

    const {
        defaultLanguageSettings,
        onAddNewDocument,
        onModalHide,
        parentItems,
    } = props;

    /* eslint-disable no-undef,no-mixed-operators */
    const [selectedCollectionId, setSelectedCollectionId] = useState<string>(undefined);
    const [selectedLanguage, setSelectedLanguage] = useState<string>(UNDEFINED_LANG);
    const [selectedCollectionParentPath, setSelectedCollectionParentPath] = useState([]);
    const [showWarning, toggleShowWarning] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [isLoadingChildren, setIsLoadingChildren] = useState(true);
    /* eslint-enable no-undef,no-mixed-operators */


    useEffect(() => {
        const lastItem = parentItems[parentItems.length - 1];
        if (!lastItem) {
            return;
        }
        setSelectedCollectionId(lastItem.id);
        setSelectedCollectionParentPath(parentItems.slice(0, parentItems.length - 1).map(item => item.id));
    }, [parentItems, setSelectedCollectionParentPath, setSelectedCollectionId]);
    useEffect(() => {
        if (!defaultLanguageSettings) {
            return;
        }
        setSelectedLanguage(defaultLanguageSettings);
    }, [defaultLanguageSettings, setSelectedLanguage]);

    const onSelect = (
        collectionId: string,
        collectionDomainId: string,
        collectionParentPath: string[],
    ) => {
        setSelectedCollectionId(collectionId);
        setSelectedCollectionParentPath(collectionParentPath);
        toggleShowWarning(false);
    }

    const onSaveDocument = async () => {
        if (!selectedLanguage || !selectedCollectionId) {
            toggleShowWarning(true);
            return;
        }
        setIsCreating(true);
        await onAddNewDocument(selectedCollectionId, selectedCollectionParentPath, selectedLanguage);
        setIsCreating(false);
    }

    const renderModal = () => (
        <div className={
            classnames(
                "newDocument-cover",
                { "is-invalid": !selectedCollectionId || !selectedLanguage }
            )}>
            <Modal
                classNames="newDocument-modal"
                onHide={onModalHide}
                title={t(TK.DocManagement_DocNew)}
                onEnterKey={onSaveDocument.bind(this)}
                onEscapeKey={onModalHide}
                buttons={[
                    <Button
                        onClick={onModalHide}
                        secondary
                        text={t(TK.General_Cancel)}
                    />,
                    <Button
                        onClick={onSaveDocument.bind(this)}
                        text={t(TK.General_SetItUp)}
                        inactiveWithLoader={isCreating || isLoadingChildren}
                        isEnabled={!isLoadingChildren}
                    />,
                ]}
            >
                <p className="newDocument-modal-tip">
                    {t(TK.DocManagement_DocNewChooseCol)}:
                </p>
                <WiredTreeNavigator
                    parentItems={parentItems}
                    onSelect={onSelect}
                    allowRootSelection={true}
                    onLoadingChange={setIsLoadingChildren}
                />
                {showWarning && (
                    <p
                        className="newDocument-modal-tip newDocument-modal-tip--warning"
                    >
                        {t(TK.DocManagement_ColSelect)}
                    </p>
                )}
            </Modal>
        </div>
    );

    return renderModal();
};

export default AddNewDocument;
