import * as React from "react";
import { useTranslation } from "@binders/client/lib/react/i18n";

const { useCallback, useState } = React;

type ParseCb = (
    file: Blob,
    setIsParsing: (parsing: boolean) => void,
    setHasErrors: (hasErrors: boolean) => void,
    setErrors: (errors: string[]) => void,
    setRows: (rows: string[][]) => void,
) => Promise<void>;

export type UseFileUploadProps = {
    fileInputRef: React.MutableRefObject<HTMLInputElement>;
    parse: ParseCb;
}

export type UseFileUpload = {
    hasErrors: boolean;
    errors: string[];
    fileName?: string;
    isParsing: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    loadFile: (e: any) => void;
    reset: () => void;
    rows: string[][];
    triggerDialog: () => void;
}

export function useFileUpload({
    fileInputRef,
    parse
}: UseFileUploadProps): UseFileUpload {
    const [hasErrors, setHasErrors] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const [rows, setRows] = useState<string[][]>([]);
    const [chosenFile, setChosenFile] = useState<{ name: string } | undefined>();
    const { t } = useTranslation();

    const reset = useCallback(() => {
        setChosenFile(undefined);
        setIsParsing(false);
        setHasErrors(false);
        setErrors([]);
        setRows([]);
    }, []);

    const triggerDialog = useCallback(() => {
        reset();
        fileInputRef.current.click();
    }, [reset, fileInputRef]);

    const parseCb = useCallback(parse, [setErrors, setHasErrors, setRows, setIsParsing, t, parse]);

    const loadFile = useCallback((e) => {
        reset();
        const files = e.dataTransfer ? e.dataTransfer.files : e.target.files;
        if (files) {
            setChosenFile(files[0]);
            parseCb(files[0], setIsParsing, setHasErrors, setErrors, setRows);
        }
    }, [setChosenFile, parseCb, reset]);

    return {
        hasErrors,
        errors,
        fileName: chosenFile?.name,
        isParsing,
        rows,
        loadFile,
        reset,
        triggerDialog,
    }
}

