import * as Papa from "papaparse";
import * as chardet from "chardet";
import { UseFileUpload, UseFileUploadProps, useFileUpload } from "./useFileUpload";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";

export async function detectEncoding(file: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const buffer = new Uint8Array(reader.result as ArrayBuffer);
            const encoding = chardet.detect(buffer);
            resolve(encoding);
        };
        reader.onerror = (e) => reject(e);
        reader.readAsArrayBuffer(file);
    });
}

export function parseCsv(file: Blob, encoding: string): Promise<string[][]> {
    const output: string[][] = [];
    return new Promise((resolve, reject) => {
        const parserOptions = {
            encoding,
            delimitersToGues: [",", ";"],
            skipEmptyLines: "greedy",
            error: function (err: { message: string }) {
                // eslint-disable-next-line no-console
                console.error(err);
                reject(new Error(`Invalid csv.\n${err.message}`));
            },
            step: function (results: { data: string[] }) {
                output.push(results.data);
            },
            complete: function () {
                resolve(output);
            }
        };
        Papa.parse(file, parserOptions);
    });
}

export function useCsvFileUpload({
    fileInputRef
}: Omit<UseFileUploadProps, "parse">): UseFileUpload {
    const { t } = useTranslation();

    const parse =  async (
        file: Blob,
        setIsParsing: (parsing: boolean) => void,
        setHasErrors: (hasErrors: boolean) => void,
        setErrors: (errors: string[]) => void,
        setRows: (rows: string[][]) => void,
    ) => {
        setIsParsing(true);
        let encoding = "utf-8";
        try {
            encoding = await detectEncoding(file);
        } catch (e) {
            setHasErrors(true);
            setErrors([t(TK.User_ImportWrongEncoding)]);
            setIsParsing(false);
            return;
        }
        try {
            const output = await parseCsv(file, encoding);
            setRows(output);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e);
            setHasErrors(true);
            setErrors([t(TK.General_ErrorCSV), e.toString()]);
        } finally {
            setIsParsing(false);
        }
    }

    return useFileUpload({ fileInputRef, parse });
}
