import * as XLSX from "xlsx";
import { UseFileUpload, UseFileUploadProps, useFileUpload } from "./useFileUpload";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";

export function useXlsxFileUpload({
    fileInputRef
}: Omit<UseFileUploadProps, "parse">): UseFileUpload {
    const { t } = useTranslation();

    const parse = async (
        file: Blob,
        setIsParsing: (parsing: boolean) => void,
        setHasErrors: (hasErrors: boolean) => void,
        setErrors: (errors: string[]) => void,
        setRows: (rows: string[][]) => void,
    ) => {
        setIsParsing(true);
        try {
            const workbook = XLSX.read(await file.arrayBuffer());
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonOptions = {
                header: 1,
            }
            const raw_data: string[][] = XLSX.utils.sheet_to_json(sheet, jsonOptions);
            setRows(raw_data);
        } catch (e) {
            setHasErrors(true);
            setErrors([t(TK.General_ErrorXLSX), e.toString()]);
        } finally {
            setIsParsing(false);
        }
    }
    return useFileUpload({ fileInputRef, parse });
}
