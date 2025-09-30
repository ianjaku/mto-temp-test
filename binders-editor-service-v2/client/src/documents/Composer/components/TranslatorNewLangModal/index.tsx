import * as React from "react";
import Button from "@binders/ui-kit/lib/elements/button";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { isMobileView } from "@binders/ui-kit/lib/helpers/rwd";
import { useTranslation } from "@binders/client/lib/react/i18n";

const { useCallback, useState, useEffect } = React;

interface ITranslatorNewLangModalProps {
    languageInfo: {name: string};
    addTranslatorLanguage: (code: string) => void;
    onHide: () => void;
    languageCode: string;
}

const TranslatorNewLangModal: React.FC<ITranslatorNewLangModalProps> = (props: ITranslatorNewLangModalProps) => {
    const { languageInfo, addTranslatorLanguage, onHide, languageCode } = props;
    const { t }: { t: TFunction } = useTranslation();


    const addLanguage = useCallback(()=> {
        addTranslatorLanguage(languageCode);
        onHide();
    }, [addTranslatorLanguage, languageCode, onHide]);


    const goToNextStage = useCallback(()=> {
        if (isMobileView()) {
            onHide();
            return;
        }
        setInfo(t(TK.Edit_TranslatorAddNewLanguageLater));
        setButtons([
            <Button text={t(TK.General_Ok)} onClick={onHide} />
        ]);
        setOnHideModal(() => () => onHide());
    }, [onHide, t]);


    useEffect(() => {
        setButtons([
            <Button text={t(TK.General_Yes)} onClick={addLanguage} />,
            <Button text={t(TK.General_No)} onClick={goToNextStage} />
        ])
    }, [addLanguage, goToNextStage, t ]);


    const [buttons, setButtons] = useState([
        <Button text={t(TK.General_Yes)} onClick={addLanguage} />,
        <Button text={t(TK.General_No)} onClick={goToNextStage} />
    ]);
    const [info, setInfo] = useState(t(TK.Edit_TranslatorAddNewLanguage,{language: languageInfo.name}));
    const [onHideModal, setOnHideModal] = useState(() => () => goToNextStage());


    return (
        <Modal
            title={t(TK.Edit_LangAddNew)}
            buttons={buttons}
            onHide={onHideModal}
        >
            <p>
                {info}
            </p>
        </Modal>
    );
}

export default TranslatorNewLangModal;
