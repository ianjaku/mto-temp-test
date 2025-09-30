interface Transaction {
    name: string;
    account: string;
    transaction: string;
    date: Date;
    amount: number;
}

interface UnmappedTransaction extends Transaction {
    sheet: string;
}

interface TransactionMatcher {
    name: string;
    date?: Date;
    amount?: number | string;
    transaction?: string;
}

function isNumericPredicateMatch(predicate: string, value: number): boolean {
    const match = predicate.match(/^([<>])\s*(\d+)$/);
    if (!match) {
        throw new Error(`Invalid numeric predicate: ${predicate}`);
    }
    const operator = match[1];
    const operand = parseInt(match[2]);
    switch (operator) {
        case "<":
            return value < operand;
        case ">":
            return value > operand;
        default:
            throw new Error(`Invalid operator: ${operator}`);
    }
}

function scoreMatch(transaction: Transaction, matcher: TransactionMatcher): number {
    let score = 0;
    if (!transaction.name.includes(matcher.name)) {
        return 0;
    }
    score++;
    if (matcher.date) {
        if (transaction.date.getTime() !== matcher.date.getTime()) {
            return 0;
        }
        score++;
    }
    if (matcher.amount) {
        if(typeof matcher.amount === "number" && transaction.amount !== matcher.amount) {
            return 0;
        }
        if (typeof matcher.amount === "string" && !isNumericPredicateMatch(matcher.amount, transaction.amount)) {
            return 0;
        }
        score++;
    }
    if (matcher.transaction) {
        if (!transaction.transaction.toLowerCase().includes(matcher.transaction.toLocaleLowerCase())) {
            return 0;
        }
        score++;
    }
    return score;
}

interface EntryMapping {
    heading: CashflowHeading;
    category: CashflowCategory;
    alias?: string;
}

interface TransactionMapping {
    matcher: TransactionMatcher;
    entryMapping: EntryMapping;
}

class TransactionMapper {
    private mappingsMap: Record<string, TransactionMapping[]>;
    private mappingKeys: string[];

    constructor(mappings: TransactionMapping[]) {
        this.mappingsMap = {};
        for (const mapping of mappings) {
            if (!this.mappingsMap[mapping.matcher.name]) {
                this.mappingsMap[mapping.matcher.name] = [];
            }
            this.mappingsMap[mapping.matcher.name].push(mapping);
        }
        this.mappingKeys = Object.keys(this.mappingsMap);
    }

    mapTransaction(transaction: Transaction): CashflowEntry | undefined {
        const mappingKeys = this.mappingKeys.filter(k => transaction.name.includes(k));
        // add transaction only matchers
        mappingKeys.push("");
        let bestScore = 0;
        let bestMapping: TransactionMapping | undefined = undefined;
        for (const mappinKey of mappingKeys) {
            const mappings = this.mappingsMap[mappinKey];
            for (const mapping of mappings) {
                const score = scoreMatch(transaction, mapping.matcher);
                if (score > bestScore) {
                    bestScore = score;
                    bestMapping = mapping;
                }
            }
        }
        if (bestMapping) {
            return {
                heading: bestMapping.entryMapping.heading,
                category: bestMapping.entryMapping.category,
                counterParty: bestMapping.entryMapping.alias || transaction.name,
                amount: transaction.amount,
                date: getFirstDayOfMonth(transaction.date)
            };
        }
        return undefined;
    }
}

function loadMapper() {
    const sheetName = "Transaction Mappings";
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
        throw new Error(`Sheet ${sheetName} not found`);
    }
    const data = sheet.getDataRange().getValues();
    const rawHeaders = data.shift();
    if (!rawHeaders) {
        throw new Error("No headers found");
    }
    const headers = rawHeaders
        .map(h => {
            const header = h.replace(/[()]/g, "");
            return header.trim();
        });

    const mappings: TransactionMapping[] = [];
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const obj = {};
        let hasValues = false;
        headers.forEach((header, i) => {
            if (header !== "->") {
                if (row[i]) {
                    hasValues = true;
                }
                obj[header] = row[i];
            }
        });
        if (!hasValues) {
            continue;
        }
        const name = obj["name"]?.toLowerCase();
        const transaction = obj["transaction"];
        if (!name && !transaction) {
            Logger.log(JSON.stringify(obj, null, 2));
            throw new Error(`Missing name and/or transaction on row ${i + 2}`);
        }
        const matcher: TransactionMatcher = {
            name,
            date: obj["date"],
            amount: obj["amount"],
            transaction
        };
        const category = obj["category"];
        if (!category) {
            throw new Error(`Missing category on row ${i + 2}`);
        }
        const entryMapping: EntryMapping = {
            heading: obj["heading"],
            category,
            alias: obj["alias"]
        };
        mappings.push({
            matcher,
            entryMapping
        });
    }
    return new TransactionMapper(mappings);
}