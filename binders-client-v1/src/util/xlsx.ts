import * as XLSX from "xlsx";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function exportRowsToSheetsFiles(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Array<Array<any>>,
    sheetName = "SheetJS",
    filename = "sheet.xlsx",
    csv = false,
) {
    try {
        const workBook = XLSX.utils.book_new();
        const workSheet = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(workBook, workSheet, sheetName);
        const opts: XLSX.WritingOptions = csv ? { bookType: "csv" } : undefined;
        XLSX.writeFile(workBook, filename, opts);
    } catch (e) {
        // eslint-disable-next-line no-console
        console.log("XLSX ERROR:", e);
    }
}
