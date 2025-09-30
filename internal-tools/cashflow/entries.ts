
type CashflowCategory = string;

type CashflowHeading = "Income" | "Expenses" | "Finance" | "Unknown";

interface CashflowEntry {
    heading: CashflowHeading;
    category: CashflowCategory;
    counterParty?: string;
    amount: number;
    date: Date;
}

function transactionToEntry(mapper: TransactionMapper, transaction: Transaction): CashflowEntry | undefined {
    const entry = mapper.mapTransaction(transaction);
    if (entry === undefined) {
        Logger.log("No mapping found for transaction: " + JSON.stringify(transaction));
    }
    return entry;
}

function groupByMonth(entries: CashflowEntry[]) {
    const grouped: Record<string, number> = {};
    const monthKeys = getAllCashflowSheetMonthKeys();
    for (const monthKey of monthKeys) {
        grouped[monthKey] = 0;
    }
    for (const entry of entries) {
        const monthKey = getMonthString(entry.date);
        if (! (monthKey in grouped)) {
            continue;
        }
        grouped[monthKey] += entry.amount;
    }
    return grouped;
}