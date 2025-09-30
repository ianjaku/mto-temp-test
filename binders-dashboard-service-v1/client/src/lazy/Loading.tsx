import * as React from "react";
// import Loader from "../components/loader";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";

const Loader = (props: { text: string }) => <span>{props.text}</span>

export const LoadingFullPage: React.FC = () => {
    const { t } = useTranslation();
    return (
        <div className="lazy lazy-fullpage">
            <Loader text={`${t(TranslationKeys.General_Loading)}...`} />
        </div>
    );
};
