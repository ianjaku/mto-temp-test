import * as React from "react";
import Button from "@binders/ui-kit/lib/elements/button"
import {
    EmptyCollection as EmptyCollectionIcon,
} from "@binders/ui-kit/lib/elements/icons/EmptyCollection";
import { FC } from "react";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useHistory } from "react-router-dom";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./EmptyCollection.styl"

export const EmptyCollection: FC = () => {
    const history = useHistory();
    const { t } = useTranslation();

    const canGoBack = document.referrer != null && document.referrer.length > 0

    return (
        <div className="empty-collection">
            <div className="empty-collection__icon">
                <EmptyCollectionIcon />
            </div>
            <p className="empty-collection__message">{t(TK.General_EmptyCollection)}</p>
            <div className="empty-collection__buttons">
                <Button
                    branded
                    CTA
                    text={canGoBack ? t(TK.General_GoBack) : t(TK.General_GoHome)}
                    onClick={
                        () => canGoBack ?
                            history.goBack() :
                            history.push("/")
                    }
                />
            </div>
        </div>
    );
}
