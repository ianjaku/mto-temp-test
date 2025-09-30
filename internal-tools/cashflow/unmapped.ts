const UNMAPPED_TRANSACTIONS_SHEET = "Unmapped Transactions"

function dumpUnmappedTransactions(transactions: UnmappedTransaction[]) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(UNMAPPED_TRANSACTIONS_SHEET);
    if (sheet === null) {
        sheet = ss.insertSheet(UNMAPPED_TRANSACTIONS_SHEET);
    }
    sheet.clear();
    if (transactions.length > 0) {
        const rows = transactions.map(t => [t.sheet, t.date, t.name, t.account, t.transaction, t.amount]);
        sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    }
}

function unmappedTransactionToEntry(transaction: Transaction): CashflowEntry {
    return {
        heading: "Unknown",
        category: "Unknown",
        counterParty: transaction.name || "" + transaction.transaction || "",
        amount: transaction.amount,
        date: getFirstDayOfMonth(transaction.date)
    }
}