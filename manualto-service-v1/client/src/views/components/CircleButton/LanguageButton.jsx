import * as React from "react";
import CircleButton from ".";
import { omit } from "ramda";

const { useMemo } = React;

export default (props) => {
    const { languageCode } = props;
    const [mainLanguageCode, dialectCode ] = useMemo(() => {
        return (languageCode.indexOf("-") >= 0) ?
            languageCode.split("-") :
            [languageCode, undefined];
    }, [languageCode]);
    const className = `language-code-button ${props.className || ""} ${props.isSelected ? "is-active" : ""}`;
    return (
        <CircleButton
            {...omit(["languageCode", "className"], props)}
            className={className}
            value={languageCode}
            text={mainLanguageCode}
            subText={dialectCode}
            isLoading={props.isLoading}
        />
    );
};
