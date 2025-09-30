function debug(msg: string): void {
    const ui = SpreadsheetApp.getUi();
    ui.alert("DEBUG: " + msg);
}

function getFirstDayOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthString(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth() + 1}`
}

function getDayString(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

function getCashflowSheetRowCount() {
    let rows = 0;
    const date = new Date(
        CASHFLOW_START_DATE.getFullYear(),
        CASHFLOW_START_DATE.getMonth(),
        CASHFLOW_START_DATE.getDate()
    );
    while (date.getTime() <= CASHFLOW_END_DATE.getTime()) {
        rows++;
        date.setMonth(date.getMonth() + 1);
    }
    return rows;
}

const CASHFLOW_START_DATE = new Date(2016, 0, 1);
const CASHFLOW_END_DATE = new Date(2024, 11, 31);
const CASHFLOW_SHEET_ROW_COUNT = getCashflowSheetRowCount();

function getCashflowSheetEmptyRow(extraRows: number) {
    return Array(CASHFLOW_SHEET_ROW_COUNT + extraRows).fill("");
}

function getAllCashflowSheetMonthKeys() {
    const keys: string[] = [];
    const date = new Date(
        CASHFLOW_START_DATE.getFullYear(),
        CASHFLOW_START_DATE.getMonth(),
        CASHFLOW_START_DATE.getDate()
    );
    while (date.getTime() <= CASHFLOW_END_DATE.getTime()) {
        keys.push(getMonthString(date));
        date.setMonth(date.getMonth() + 1);
    }
    return keys;
}