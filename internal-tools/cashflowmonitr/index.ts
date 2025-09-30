/* eslint-disable @typescript-eslint/no-unused-vars */

interface CSVOptions {
    start: Date;
    end: Date;
    period: number;
    increase: number;
    folderName: string;
    delay: number;
}

function getMonthHeader(date: Date): string {
    return formatMonthHeader(date.getMonth() + 1, date.getFullYear());
}

function formatMonthHeader(month: number, year: number) {
    const paddedMonth = `${month}`.padStart(2, "0");
    return `01-${paddedMonth}-${year}`;
}

function incrementMonthHeader(header: string): string {
    let [, month, year] = header.split("-").map(x => parseInt(x, 10));
    month++;
    if (month === 13) {
        month = 1;
        year++;
    }
    return formatMonthHeader(month, year);
}

function getCSVHeaders(options: CSVOptions): string[] {
    const headers = ["Name"];
    const { start, end } = options;
    let runningHeader = getMonthHeader(start);
    const endHeader = getMonthHeader(end);
    do {
        headers.push(runningHeader);
        runningHeader = incrementMonthHeader(runningHeader);
    } while (runningHeader != endHeader);
    headers.push(runningHeader);
    return headers;
}

function parseDate(input: string): Date {
    const [day, month, year] = input.split("-").map(x => parseInt(x, 10));
    return new Date(year, month - 1, day);
}

function loadDefaultSettings(): CSVOptions {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Description");
    if (!sheet) {
        throw new Error("Description sheet not found");
    }
    const rangeValues = sheet.getRange(1, 1, 1000, 2).getValues();
    let beforeArea = true;
    const defaultSettings =  {};
    for (const row of rangeValues) {
        if (row[0].includes("Default settings")) {
            beforeArea = false;
            continue;
        }
        if (beforeArea) {
            continue;
        }
        if (row[0] === "Period (months)") {
            defaultSettings["period"] = row[1];
            continue;
        }
        if (row[0] === "Increase") {
            defaultSettings["increase"] = row[1];
            continue;
        }
        if (row[0] === "Start") {
            defaultSettings["start"] = row[1];
            continue;
        }
        if (row[0] === "End") {
            defaultSettings["end"] = row[1];
            continue;
        }
        if (row[0].includes("Delay")) {
            defaultSettings["delay"] = row[1];
        }
    }
    return defaultSettings as CSVOptions;
}

let exportLinks: {name: string, url: string}[] = [];

function exportToCSV() {
    updateCSVExports();
    showCSVDownloadDialog();
}

function isExpenseSheet(sheetName: string): boolean {
    return sheetName.startsWith("EXP");
}

function isIncomeSheet(sheetName: string): boolean {
    return sheetName.startsWith("INC");
}

function getSheetsToExport(): string[] {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const result: string[] = [];
    for (const sheet of sheets) {
        const sheetName = sheet.getName();
        if (
            isExpenseSheet(sheetName) ||
            isIncomeSheet(sheetName)
        ) {
            result.push(sheetName);
        }
    }
    return result;
}

function determineSheetType(sheetHeaders: string[]): "recurring" | "onetime" {
    if (sheetHeaders.includes("Start") && sheetHeaders.includes("End")) {
        return "recurring";
    }
    if (sheetHeaders.includes("Date") && sheetHeaders.includes("Period")) {
        return "recurring";
    }
    throw new Error("One-time sheets not supported yet");
}

function recurringEntryToCSVRow(defaultSettings, name, amount, start, end, period, increase, delay): string {
    let runningHeader = getMonthHeader(defaultSettings.start);
    let runningAmount = amount;
    const endHeader = getMonthHeader(defaultSettings.end);
    const recurringEndHeader = getMonthHeader(end);
    const cells: string | number[] = [ name ];
    let nextHeaderWithValue = getMonthHeader(start);
    let nextHeaderWithValueValid = true;
    if (start.getTime() < defaultSettings.start.getTime()) {
        nextHeaderWithValueValid = false;
    }
    if (delay) {
        for (let i = 0; i < delay; i++) {
            nextHeaderWithValue = incrementMonthHeader(nextHeaderWithValue);
            if (!nextHeaderWithValueValid) {
                nextHeaderWithValueValid = nextHeaderWithValue == runningHeader;
            }
        }
    }
    while (!nextHeaderWithValueValid) {
        for (let i = 0; i < period; i++) {
            nextHeaderWithValue = incrementMonthHeader(nextHeaderWithValue);
            if (!nextHeaderWithValueValid) {
                nextHeaderWithValueValid = nextHeaderWithValue == runningHeader;
            }
        }
    }
    let stopped = false;
    do {
        if (!stopped && runningHeader === nextHeaderWithValue) {
            cells.push(runningAmount)
            runningAmount = runningAmount * (1 + increase);
            for (let i = 0; i < period; i++) {
                nextHeaderWithValue = incrementMonthHeader(nextHeaderWithValue);
            }
        } else {
            cells.push(0);
        }
        if (runningHeader == recurringEndHeader) {
            stopped = true;
        }
        runningHeader = incrementMonthHeader(runningHeader);
    } while (runningHeader != endHeader);

    if (runningHeader == recurringEndHeader) {
        cells.push(runningAmount);
    } else {
        cells.push(0);
    }
    return serializeRow(cells);

}

function serializeRow(cells: (string|number)[]): string {
    return cells.map(x => `"${x}"`).join(";");
}

const allExpensesRows: string[] = [];

function exportRecurringSheetToCSV(
    defaultSettings: CSVOptions,
    sheetName: string,
    headerValues: string[],
    sheetValues: (string | number) [][],
    folder: GoogleAppsScript.Drive.Folder,
) {
    Logger.log(`Exporting ${sheetValues.length} rows from ${sheetName}`);

    const nameIndex = headerValues.indexOf("Name");
    const amountIndex = headerValues.indexOf("Amount");
    const startIndex = headerValues.indexOf("Start");
    const dateIndex = headerValues.indexOf("Date");
    const endIndex = headerValues.indexOf("End");
    const periodIndex = headerValues.indexOf("Period");
    const increaseIndex = headerValues.indexOf("Increase");
    const delayIndex = headerValues.indexOf("Delay");
    const csvHeaderRow = serializeRow(getCSVHeaders(defaultSettings));
    const csvRows = [
        csvHeaderRow
    ];
    if (allExpensesRows.length == 0) {
        allExpensesRows.push(csvHeaderRow);
    }
    for (const row of sheetValues) {
        const isIncome = isIncomeSheet(sheetName);
        const name = row[nameIndex];
        const amount = (row[amountIndex] as number);
        const start = row[startIndex] || row[dateIndex] || defaultSettings.start;
        const end = row[endIndex] || defaultSettings.end;
        const period = row[periodIndex] || defaultSettings.period;
        const increase = row[increaseIndex] || defaultSettings.increase;
        const delay = isIncome ?
            row[delayIndex] || defaultSettings.delay :
            0 ;
        if (name && amount) {
            const amountFactor = isIncome ? 1 : -1;
            const csvRow = recurringEntryToCSVRow(defaultSettings, name, amountFactor * amount, start, end, period, increase, delay);
            csvRows.push(csvRow);
            if(isExpenseSheet(sheetName)) {
                allExpensesRows.push(csvRow);
            }
        } else {
            Logger.log(`Skipping row ${row}`);
        }
    }
    const fileName = sheetName + ".csv";
    const csvFileContents = csvRows.join("\n");
    const file = folder.createFile(fileName, csvFileContents);
    exportLinks.push({
        name: sheetName,
        url: file.getUrl()
    });
}

function exportSheetToCSV(
    defaultSettings: CSVOptions,
    sheetName: string,
    headerValues: string[],
    sheetValues: string[][],
    folder: GoogleAppsScript.Drive.Folder
) {
    const sheetType = determineSheetType(headerValues);
    if (sheetType === "recurring") {
        exportRecurringSheetToCSV(defaultSettings, sheetName, headerValues, sheetValues, folder);
    }
}

function exportSheet(defaultSettings: CSVOptions, sheetName: string, folder: GoogleAppsScript.Drive.Folder) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
        throw new Error(`Sheet ${sheetName} not found`);
    }
    const sheetValues = sheet.getRange(1, 1, 1000, 1000).getValues();
    const headerValues = sheetValues.shift() as string[];
    exportSheetToCSV(defaultSettings, sheetName, headerValues, sheetValues, folder);
}

function updateCSVExports() {
    const sheetsToExport = getSheetsToExport();
    const defaultSettings = loadDefaultSettings();

    const folder = DriveApp.createFolder("Monitr_csv_" + new Date().getTime());
    for (const sheetToExport of sheetsToExport) {
        exportSheet(defaultSettings, sheetToExport, folder);
    }
    const fileName = "ALL EXP.csv";
    const csvFileContents = allExpensesRows.join("\n");
    const file = folder.createFile(fileName, csvFileContents);
    exportLinks = [
        {
            name: "ALL EXP",
            url: file.getUrl()
        },
        ...exportLinks
    ];

}

function showCSVDownloadDialog() {
    const content = HtmlService
        .createTemplateFromFile("Download")
        .evaluate();
    SpreadsheetApp.getUi()
        .showModalDialog(content, "Download CSVs");
}

function onOpen() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const ui = SpreadsheetApp.getUi();
    ui.createMenu("Monitr")
        .addItem("Export", "exportToCSV")
        .addToUi();
}





