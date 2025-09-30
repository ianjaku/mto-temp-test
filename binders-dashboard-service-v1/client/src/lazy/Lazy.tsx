import * as React from "react";
import { ErrorBoundary } from "./Error";
import "./Lazy.styl";

export type LazyProps = {
    children: React.ReactNode;
    loading: React.ReactNode;
    error: React.ReactNode;
}

export const Lazy: React.FC<LazyProps> = ({ children, error, loading }) => (
    <ErrorBoundary fallback={error}>
        <React.Suspense fallback={loading}>
            {children}
        </React.Suspense>
    </ErrorBoundary>
);