const FORECAST_SHEET = "Forecast";

interface ForecastEntry {
    heading: CashflowHeading;
    category: CashflowCategory;
    name: string;
    value: number;
    increase?: number;
    start?: Date;
    end?: Date;
}

function snapToMidgnight(date: Date): Date {
    if (!date) {
        return date;
    }
    const hours = date.getHours();
    if (hours > 12) {
        date.setHours(24);
    } else {
        date.setDate(0);
    }
    return date;
}

function getForecastEntryStartAndEnd(entry: CashflowEntry, forecastStart: Date) {
    const { start, end } = entry;
    if (end && end.getTime() < forecastStart.getTime()) {
        return {
            entryStart: undefined,
            entryEnd: undefined
        }
    }
    const entryStart = !start || start.getTime() < forecastStart.getTime() ?
        forecastStart :
        start;
    const entryEnd = end || CASHFLOW_END_DATE;
    return {
        entryStart,
        entryEnd
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function forecastCashflow(grouped: GroupedEntries, forecastStart: Date): CashflowEntry[] {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(FORECAST_SHEET);
    if (!sheet) {
        throw new Error(`Sheet ${FORECAST_SHEET} not found`);
    }
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    if (!headers) {
        throw new Error("No headers found");
    }
    const allEntries = [] as CashflowEntry[];

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const obj = {} as ForecastEntry;
        headers.forEach((header, j) => {
            if (header === "start" || header === "end") {
                obj[header] = snapToMidgnight(row[j]);
            } else {
                obj[header] = row[j];
            }

        });
        if (Object.values(obj).filter(v => !!v).length === 0) {
            continue;
        }
        const { entryStart, entryEnd } = getForecastEntryStartAndEnd(obj, forecastStart);
        if (!entryStart && !entryEnd) {
            continue;
        }
        obj.start = entryStart;
        obj.end = entryEnd;
        const entries = generateForecastEntries(obj, grouped);
        allEntries.push(...entries);
    }
    return allEntries;
}

function generateForecastEntries(entry: ForecastEntry, grouped: GroupedEntries): CashflowEntry[] {
    const start = entry.start as Date;
    const end = entry.end as Date;
    const runner = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate()
    )
    const entries = [] as CashflowEntry[];
    let value = getInitialValue(entry, grouped);
    while (runner.getTime() <= end.getTime()) {
        entries.push({
            heading: entry.heading,
            category: entry.category,
            counterParty: entry.name,
            amount: value,
            date: new Date(runner.getTime())
        });
        if (entry.increase) {
            value = value * (1 + entry.increase);
        }
        runner.setMonth(runner.getMonth() + 1);
    }
    return entries;
}

function getInitialValue(entry: ForecastEntry, grouped: GroupedEntries): number {
    const value = entry.value;
    if (typeof value === "number") {
        return value;
    }
    if (typeof value === "string") {
        if (value === "last6") {
            return getLastNMonthsAverage(entry, grouped, 6);
        }
    }
    throw new Error(`Unknown value type ${value} for forecast entry ${entry.heading} - ${entry.category} - ${entry.name}`);
}

function getLastNMonthsAverage(entry: ForecastEntry, grouped: GroupedEntries, numberOfMonths: number) {
    const entries = grouped[entry.heading][entry.category][entry.name];
    if (!entries) {
        Logger.log(JSON.stringify(entry, null, 2));
        Logger.log(JSON.stringify(grouped["Expenses"]["Product - Wages"], null, 2));
        throw new Error(`No entries found for ${entry.heading} - ${entry.category} - ${entry.name}`);
    }
    const groupedEntries = groupByMonth(entries);
    const groupedEntryKeys = Object.keys(groupedEntries);
    const values: number[] = [];
    let found = false;
    for (let i = groupedEntryKeys.length - 1; i >= 0; i--) {
        const key = groupedEntryKeys[i];
        const value = groupedEntries[key];
        if (value != 0) {
            found = true;
        }
        if (found) {
            values.push(value);
            if (values.length >= numberOfMonths) {
                break;
            }
        }
    }
    return values.reduce((a, b) => a + b, 0) / values.length;
}