import * as React from "react";
import { CsvParseResult } from "./types";
import { User } from "@binders/client/lib/clients/userservice/v1/contract"
import { UserImportPayload } from "./useImportUsers";
import { parseUsersArrays } from "./parseManualtoCsv";
import { useTranslation } from "@binders/client/lib/react/i18n";

const { useCallback, useMemo, useState } = React;

export type UseManualtoImportProps = {
    parse: () => CsvParseResult<User>;
}

export type UseManualtoImport = {
    hasErrors: boolean;
    importUsersPayload: UserImportPayload;
    isParsing: boolean;
    parse: (rows: string[][]) => void;
    previewData: CsvParseResult<User>;
    replaceInGroup: boolean;
    reset: () => void;
    selectedUsergroupId: string;
    setReplaceInGroup: React.Dispatch<React.SetStateAction<boolean>>;
    setSelectedUsergroupId: React.Dispatch<React.SetStateAction<string>>;
}

const INITIAL_PREVIEW_DATA: CsvParseResult<User> = {
    type: "table",
    hasError: false,
    columnCount: 0,
    rows: [],
};

export function useManualtoUserImport(): UseManualtoImport {
    const [hasErrors, setHasErrors] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [previewData, setPreviewData] = useState<CsvParseResult<User>>(INITIAL_PREVIEW_DATA);
    const [replaceInGroup, setReplaceInGroup] = useState(false);
    const [selectedUsergroupId, setSelectedUsergroupId] = useState("");
    const { t } = useTranslation();

    const reset = useCallback(() => {
        setHasErrors(false);
        setIsParsing(false);
        setPreviewData(INITIAL_PREVIEW_DATA);
    }, []);

    const parse = useCallback((rows: string[][]) => {
        reset();
        try {
            const parseResponse = parseUsersArrays([ ...rows ], t);
            setPreviewData(parseResponse);
            setHasErrors(parseResponse.type === "error" || parseResponse.hasError);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e);
            setHasErrors(true);
        } finally {
            setIsParsing(false);
        }
    }, [reset, setHasErrors, setPreviewData, setIsParsing, t]);

    const importUsersPayload = useMemo(() => {
        if (previewData.type === "error") return [];
        if (previewData.hasError) return [];
        const users = previewData.rows
            .filter(row => row.type === "row")
            .map(row => row.type === "row" && row.cell);
        return ([
            { users, usergroupId: selectedUsergroupId, replaceInGroup },
        ])
    }, [previewData, selectedUsergroupId, replaceInGroup]);

    return {
        importUsersPayload,
        previewData,
        hasErrors,
        isParsing,
        parse,
        replaceInGroup,
        reset,
        setReplaceInGroup,
        selectedUsergroupId,
        setSelectedUsergroupId,
    }
}
