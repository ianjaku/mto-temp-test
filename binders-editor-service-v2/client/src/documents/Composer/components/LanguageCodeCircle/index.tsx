import * as React from "react";
import { UNDEFINED_LANG, UNDEFINED_LANG_UI } from "@binders/client/lib/util/languages";
import cx from "classnames";
import { isDialect } from "@binders/client/lib/languages/helper";
import "./LanguageCodeCircle.styl";

interface IProps {
    languageCode: string;
    isMaster?: boolean;
    onClick?: () => void;
}

export default ({ languageCode, isMaster, onClick }: IProps): React.ReactElement => {
    const { languageCodeUi, dialectCodeUi } = React.useMemo(() => {
        const languageCodeUi = languageCode === UNDEFINED_LANG ? UNDEFINED_LANG_UI : languageCode
        if (isDialect(languageCodeUi)) {
            const codes = languageCode.split("-");
            return {
                languageCodeUi: codes[0],
                dialectCodeUi: codes[1],
            }
        }
        return {
            languageCodeUi,
        }
    }, [languageCode]);

    return (
        <div
            className={cx("languagecode-circle", { "languagecode-circle--is-master": isMaster })}
            onClick={onClick}
        >
            <label className="languagecode-circle-text languagecode-circle-text--primary">
                {languageCodeUi}
            </label>
            {dialectCodeUi && (
                <label className="languagecode-circle-text languagecode-circle-text--secondary">
                    {dialectCodeUi}
                </label>
            )}
        </div>
    )
};
