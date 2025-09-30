import * as React from "react";
import { useEffect, useState } from "react";
import { BoxFooter } from "../../../../components/generic-box/box-footer/BoxFooter";
import { BoxHeader } from "../../../../components/generic-box/box-header/BoxHeader";
import { GenericBox } from "../../../../components/generic-box/GenericBox";
import "./error-message.styl";

export const ErrorMessage: React.FC<{error: Error}> = ({ error }) => {
    const [errorMessage, setErrorMessage] = useState("An unknown error has occured.");

    useEffect(() => {
        if ("statusCode" in error) {
            const backendError = (error as unknown) as {statusCode: number, errorDetails: string};
            if (typeof backendError.errorDetails !== "string") return;
            setErrorMessage(backendError.errorDetails);
        }
    }, [setErrorMessage, error])

    return (
        <GenericBox>
            <BoxHeader>{errorMessage}</BoxHeader>
            <div className="error-message">
                <p className="error-message-paragraph">
                    You can reach us at support@manual.to
                </p>
                <p className="error-message-paragraph">
                    For debugging purposes, please include the following information
                    in your support request:
                </p>
                <div className="error-message-error">
                    {error?.toString()}
                </div>
                <BoxFooter />
            </div>
        </GenericBox>
    );
}
