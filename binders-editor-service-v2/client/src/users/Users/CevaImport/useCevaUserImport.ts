import * as React from "react";
import { CevaUser, UserDetails } from "@binders/client/lib/clients/userservice/v1/contract"
import { CevaUserImportPayload } from "./cevaTypes";
import { CsvParseResult } from "../../../hooks/types";
import { FlashMessages } from "../../../logging/FlashMessages";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { UseImportUsers } from "../../../hooks/useImportUsers";
import { importCevaUsers } from "../../actions";
import { invalidateAllGroupQueries } from "../../query";
import { parseCevaRows } from "./parseCevaXlsx";
import { useTranslation } from "@binders/client/lib/react/i18n";

const { useCallback, useMemo, useState } = React;

export type UseCevaImportUsersProps = {
    account: { id: string };
    myDetails: UserDetails | undefined;
}

export type UseCevaImportPreview = {
    toggleVisible: () => void;
    importUsersPayload: CevaUserImportPayload;
    previewData: CsvParseResult<CevaUser>;
    isParsing: boolean;
    isVisible: boolean;
    hasErrors: boolean;
    parse: (rows: string[][]) => void;
    reset: () => void;
}

const INITIAL_PREVIEW_DATA: CsvParseResult<CevaUser> = {
    type: "table",
    hasError: false,
    columnCount: 0,
    rows: [],
};

export function useCevaImportProcess({ account, myDetails }: UseCevaImportUsersProps): UseImportUsers<CevaUserImportPayload> {
    const [isImportingUsers, setIsImportingUsers] = useState(false);
    const [error, setError] = useState<string | null>();
    const { t } = useTranslation();

    const reset = useCallback(() => {
        setIsImportingUsers(false);
        setError(null);
    }, []);

    const importUsersCallback = useCallback(async function(payload: CevaUserImportPayload, close: () => void) {
        if (!myDetails) return;
        reset();
        try {
            setIsImportingUsers(true);
            await importCevaUsers(
                account.id,
                payload.users,
                myDetails.user,
                true,
            );
            invalidateAllGroupQueries();
            FlashMessages.success(t(TK.User_CSVSuccess));
            close();
        } catch (ex) {
            const error = t(TK.User_CSVImportError);
            setError(error);
            FlashMessages.error(error);
            return
        } finally {
            setIsImportingUsers(false);
        }
    }, [account, myDetails, reset, setIsImportingUsers, t]);

    return {
        isImportingUsers,
        importUsers: importUsersCallback,
        error,
        reset,
    }
}

export function useCevaImportPreview(): UseCevaImportPreview {
    const [isVisible, setIsVisible] = useState(false);
    const [hasErrors, setHasErrors] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [previewData, setPreviewData] = useState(INITIAL_PREVIEW_DATA);
    const { t } = useTranslation();

    const reset = useCallback(() => {
        setHasErrors(false);
        setIsParsing(false);
        setPreviewData(INITIAL_PREVIEW_DATA);
    }, []);

    const parse = useCallback((rows: string[][]) => {
        reset();
        setIsParsing(true);
        const parseResponse = parseCevaRows([...rows], t);
        setPreviewData(parseResponse);
        setHasErrors(parseResponse.type === "error" || parseResponse.hasError);
        setIsParsing(false);
    }, [reset, setHasErrors, setPreviewData, setIsParsing, t]);

    const importUsersPayload = useMemo<CevaUserImportPayload>(() => {
        if (previewData.type === "error") return { users: [] };
        if (previewData.hasError) return { users: [] };
        const users: CevaUser[] = previewData.rows
            .filter(row => row.type === "row")
            .map(row => row.type === "row" ? row.cell : null);
        const payload: CevaUserImportPayload = { users };
        return payload;
    }, [previewData]);

    return {
        toggleVisible: () => setIsVisible(val => !val),
        importUsersPayload,
        previewData,
        hasErrors,
        isParsing,
        isVisible,
        parse,
        reset,
    }
}
