import * as React from "react";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./Error.styl";

type ErrorBoundaryState = { hasError: boolean, error: unknown };

// Error boundary has to be a class component
// https://react.dev/reference/react/Component#static-getderivedstatefromerror
export class ErrorBoundary extends React.Component<{ fallback: React.ReactNode }> {
    state = { hasError: false, error: null };
    static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
        return {
            hasError: true,
            error,
        };
    }
    render(): React.ReactNode {
        if (this.state.hasError) {
            return this.props.fallback;
        }
        return this.props.children;
    }
}

export const ErrorFullPage: React.FC = () => {
    const { t } = useTranslation();
    return (
        <div className='lazy lazy-fullpage'>
            <div className="lazy-error">
                <h1>{t(TK.General_ErrorMaybeOfflineTitle)}</h1>
                <p>{t(TK.General_ErrorMaybeOfflineSolution)}</p>
            </div>
        </div>
    );
};