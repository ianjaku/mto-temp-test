
type Currency = "GBP" | "EUR";

type Convertor = (amount: number, when: Date) => number;
type ConversionRates = Record<string, number>;

function loadConversionRates(from: Currency, to: Currency): ConversionRates {
    let sheetName;
    if (from === "GBP" && to === "EUR") {
        sheetName = "GBP to EUR";
    }
    if (sheetName === undefined) {
        throw new Error(`No conversion rates found for ${from} to ${to}`);
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
        throw new Error(`Sheet ${sheetName} not found`);
    }
    const data = sheet.getDataRange().getValues();
    data.shift();
    const conversionRates: ConversionRates = {};
    data.forEach(row => {
        const key = getDayString(row[0]);
        const rate = row[1];
        conversionRates[key] = rate;
    });
    return conversionRates;
}

function getConversionRate(conversionRates: ConversionRates, when: Date): number {
    const keyDate = new Date(when);
    let rate;
    do {
        const key = getDayString(when);
        rate = conversionRates[key];
        if (rate == undefined) {
            keyDate.setDate(keyDate.getDate() - 1);
        }
    } while (rate === undefined);
    return rate;
}

function getConvertor(from: Currency, to: Currency): Convertor {
    if (from === to) {
        return (amount: number) => amount;
    }
    const conversionRates = loadConversionRates(from, to);
    return (amount: number, when: Date) => {
        const rate = getConversionRate(conversionRates, when);
        return rate * amount;
    }
}