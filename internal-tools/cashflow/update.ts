export function getCashflowEntriesFromSheet(sheetName: unknown, currencyConvertor?: Convertor): unknown {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
        throw new Error(`Sheet ${sheetName} not found`);
    }
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    if (!headers) {
        throw new Error("No headers found");
    }
    const mapper = loadMapper();
    const unmappedTransactions: UnmappedTransaction[] = [];
    const entries: CashflowEntry[] = [];
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const obj = {} as Transaction;
        headers.forEach((header, j) => {
            if (header === "name") {
                obj[header] = row[j].toLowerCase();
            } else {
                if (row[j] === "#ERROR!") {
                    obj[header] = "";
                } else {
                    if (header === "date" && row[j] !== "") {
                        obj[header] = Utilities.parseDate(row[j], "GMT", "dd/MM/yyyy");
                    } else {
                        obj[header] = row[j];
                    }
                }
            }
        });
        if (Object.values(obj).filter(v => !!v).length === 0 || !obj["amount"]) {
            continue;
        }
        if (currencyConvertor) {
            obj.amount = currencyConvertor(obj.amount, obj.date);
        }
        let entry;
        if (sheetName.includes("ING")) {
            entry = unmappedTransactionToEntry(obj);
        } else {
            entry = transactionToEntry(mapper, obj);
            if (entry === undefined) {
                unmappedTransactions.push({
                    sheet: sheetName,
                    ...obj
                });
                entry = unmappedTransactionToEntry(obj);
            }
        }
        entries.push(entry);
    }
    return {
        entries,
        unmappedTransactions
    };
}

const BEFIUS_EUR_TRANSACTION_SHEET = "Belfius EUR";
const BEFIUS_GBP_TRANSACTION_SHEET = "Belfius GBP";
const ING_EUR_TRANSACTION_SHEET = "ING EUR";
const ING_GBP_TRANSACTION_SHEET = "ING GBP";

export function updateCashflow(): void {
    const {
        entries: belfiusEuroEntries,
        unmappedTransactions: belfiusUnmappedEuroTransactions
    } = getCashflowEntriesFromSheet(BEFIUS_EUR_TRANSACTION_SHEET);
    const convertGbpToEuro = getConvertor("GBP", "EUR");
    const {
        entries: belfiusGbpEntries,
        unmappedTransactions: belfiusUnmappedGbpTransactions
    } = getCashflowEntriesFromSheet(BEFIUS_GBP_TRANSACTION_SHEET, convertGbpToEuro);
    const {
        entries: ingEurEntries
    } = getCashflowEntriesFromSheet(ING_EUR_TRANSACTION_SHEET);
    const {
        entries: ingGbpEntries
    } = getCashflowEntriesFromSheet(ING_GBP_TRANSACTION_SHEET);

    const allUnmappedTransactions = [
        ...belfiusUnmappedEuroTransactions,
        ...belfiusUnmappedGbpTransactions
    ];
    dumpUnmappedTransactions(allUnmappedTransactions);
    const allEntries = [
        ...belfiusEuroEntries,
        ...belfiusGbpEntries,
        ...ingEurEntries,
        ...ingGbpEntries,
    ];
    const lastBelfiusEuroEntryDate = belfiusEuroEntries[0].date;
    const lastBelfiusBgpEntryDate = belfiusGbpEntries[0].date;
    let lastEntryDate = lastBelfiusEuroEntryDate;
    if (lastBelfiusBgpEntryDate.getTime() > lastBelfiusEuroEntryDate.getTime()) {
        lastEntryDate = lastBelfiusBgpEntryDate;
    }
    const forecastDate = new Date(
        lastEntryDate.getFullYear(),
        lastEntryDate.getMonth() + 1,
        1
    );
    const historicalGrouped = groupEntriesByCategory(allEntries);
    const forecastEntries = forecastCashflow(historicalGrouped, forecastDate);
    allEntries.push(...forecastEntries);
    const allGrouped = groupEntriesByCategory(allEntries);
    writeCashflowSheets(allGrouped);
}
