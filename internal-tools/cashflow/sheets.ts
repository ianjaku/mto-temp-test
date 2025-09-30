type GroupedEntries = {
    [H in CashflowHeading]: {
        [category: string]: {
            [counterParty: string]: CashflowEntry[]
        }
    }
}

function groupEntriesByCategory(entries: CashflowEntry[]): GroupedEntries {
    const grouped: GroupedEntries = {
        Income: {},
        Expenses: {},
        Finance: {},
        Unknown: {},
    }
    for (const entry of entries) {
        if (!grouped[entry.heading][entry.category]) {
            grouped[entry.heading][entry.category] = {};
        }
        const counterParty = entry.counterParty || "";
        if (!grouped[entry.heading][entry.category][counterParty]) {
            grouped[entry.heading][entry.category][counterParty] = [];
        }
        grouped[entry.heading][entry.category][counterParty].push(entry);
    }
    return grouped;
}

function getMaxDataRange() {
    return "A2:DF1000"
}
function addEuroFormatting(sheet) {
    const rangeToFormat = sheet.getRange(getMaxDataRange());
    rangeToFormat.setNumberFormat('###,###,##0 €');
}

function addConditionalNumberFormatting(sheet) {
    const rangeToFormat = sheet.getRange(getMaxDataRange());
    const greenRule = SpreadsheetApp.newConditionalFormatRule()
        .whenNumberGreaterThan(0)
        .setFontColor("green")
        .setRanges([rangeToFormat])
        .build();
    const redRule = SpreadsheetApp.newConditionalFormatRule()
        .whenNumberLessThan(0)
        .setFontColor("red")
        .setRanges([rangeToFormat])
        .build();
    const grayRule = SpreadsheetApp.newConditionalFormatRule()
        .whenNumberEqualTo(0)
        .setFontColor("#808080")
        .setRanges([rangeToFormat])
        .build();
    const rules = [
        greenRule,
        redRule,
        grayRule
    ];
    sheet.setConditionalFormatRules(rules);
}

function addHeadingBorders(sheet, indices) {
    indices.forEach(index => {
        const range = sheet.getRange(`A${index + 1}:DF${index + 1}`);
        range.setBorder(false, false, true, false, false, true, "black", SpreadsheetApp.BorderStyle.DOUBLE);
    });
}

function addCategoryBorders(sheet, indices) {
    indices.forEach(index => {
        const range = sheet.getRange(`B${index + 1}:DF${index + 1}`);
        range.setBorder(false, false, true, false, false, true, "#808080", SpreadsheetApp.BorderStyle.SOLID);
    });
}

function addBoldFormatting(sheet) {
    const rangeToFormat = sheet.getRange("A1:DF4");
    rangeToFormat.setFontWeight("bold");
}

function simplifyGroupedEntries(groupedEntries: GroupedEntries): GroupedEntries {
    const simplified: GroupedEntries = {
        Income: {},
        Expenses: {},
        Finance: {},
        Unknown: {},
    }
    for (const heading of Object.keys(groupedEntries)) {
        for (const realCategory of Object.keys(groupedEntries[heading])) {
            const entries = groupedEntries[heading][realCategory];
            const simplifiedCategory = realCategory.split("-")[0].trim();
            if (!simplified[heading][simplifiedCategory]) {
                simplified[heading][simplifiedCategory] = {};
            }
            for (const counterParty of Object.keys(entries)) {
                if (!simplified[heading][simplifiedCategory][counterParty]) {
                    simplified[heading][simplifiedCategory][counterParty] = [];
                }
                simplified[heading][simplifiedCategory][counterParty].push(...entries[counterParty]);
            }
        }
    }
    return simplified;
}

function writeCashflowSheet(groupedEntriesInput: GroupedEntries, sheetName: string, includeCounterParties: boolean) {
    const groupedEntries = includeCounterParties ?
        groupedEntriesInput :
        simplifyGroupedEntries(groupedEntriesInput);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const extraCols = includeCounterParties ? 3 : 2;
    const leads = Array(extraCols).fill("");
    const profitRow = getCashflowSheetEmptyRow(extraCols);
    profitRow[0] = "P / L";
    const rows: (string | number)[][] = [
        [...leads, ...getAllCashflowSheetMonthKeys()],
        getCashflowSheetEmptyRow(extraCols)
    ]
    const cashPositionIndex = rows.length;
    const cashPositionRow = getCashflowSheetEmptyRow(extraCols);
    cashPositionRow[0] = "CASH POSITION";
    rows.push(cashPositionRow);
    const profitRowIndex = rows.length;
    rows.push(profitRow);
    rows.push(getCashflowSheetEmptyRow(extraCols));
    let categoryIndex;
    let headingIndex;
    const headingIndices: number[] = [];
    const allCategoryIndices: number[] = [];
    for (const heading of Object.keys(groupedEntries)) {
        const categoryIndices: number[] = [];
        rows.push(getCashflowSheetEmptyRow(extraCols));
        const headingRow = getCashflowSheetEmptyRow(extraCols);
        headingRow[0] = heading;
        headingIndex = rows.length;
        headingIndices.push(headingIndex);
        rows.push(headingRow);
        const groupedByCategory = groupedEntries[heading as CashflowHeading];
        const categories = Object.keys(groupedByCategory);
        categories.sort();
        for (const category of categories) {
            if (includeCounterParties) {
                const emtpyRow = getCashflowSheetEmptyRow(extraCols);
                rows.push(emtpyRow);
            }
            const categoryRow = getCashflowSheetEmptyRow(extraCols);
            categoryRow[1] = category;
            categoryIndex = rows.length;
            categoryIndices.push(categoryIndex);
            allCategoryIndices.push(categoryIndex);
            rows.push(categoryRow);
            const entriesByCategory = groupedByCategory[category];
            const counterPartyRows: any[] = [];
            const counterParties = Object.keys(entriesByCategory);
            counterParties.sort();
            for (const counterParty of counterParties) {
                const byMonth = groupByMonth(entriesByCategory[counterParty]);
                const counterPartyRow = getCashflowSheetEmptyRow(extraCols);
                if (includeCounterParties) {
                    counterPartyRow[2] = counterParty;
                }
                let colIndex = extraCols;
                for (const month of Object.keys(byMonth)) {
                    counterPartyRow[colIndex] = byMonth[month];
                    colIndex++;
                }
                if (includeCounterParties) {
                    rows.push(counterPartyRow);
                }
                counterPartyRows.push(counterPartyRow);
            }
            for (let colIndex = extraCols; colIndex < counterPartyRows[0].length; colIndex++) {
                let categoryTotal = counterPartyRows[0][colIndex];
                for (let i = 1; i < counterPartyRows.length; i++) {
                    categoryTotal += counterPartyRows[i][colIndex];
                }
                rows[categoryIndex][colIndex] = categoryTotal;
            }
        }
        for (let colIndex = extraCols; colIndex < rows[categoryIndices[0]].length; colIndex++) {
            let headingTotal = 0;
            for (const categoryIndex of categoryIndices) {
                headingTotal += rows[categoryIndex][colIndex] as number;
            }
            rows[headingIndex][colIndex] = headingTotal;
        }
    }
    for (let colIndex = extraCols; colIndex < rows[profitRowIndex].length; colIndex++) {
        let total = 0;
        for(const headingIndex of headingIndices) {
            total += rows[headingIndex][colIndex] as number;
        }
        rows[profitRowIndex][colIndex] = total;
    }
    let cashPosition = 0;
    for (let colIndex = extraCols; colIndex < rows[profitRowIndex].length; colIndex++) {
        cashPosition += rows[profitRowIndex][colIndex] as number;
        rows[cashPositionIndex][colIndex] = cashPosition;
    }
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
        throw new Error(`Sheet ${sheetName} not found`);
    }
    sheet.clear();
    sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    addConditionalNumberFormatting(sheet);
    addBoldFormatting(sheet);
    addEuroFormatting(sheet);
    if (includeCounterParties) {
        addCategoryBorders(sheet, allCategoryIndices);
    }
    addHeadingBorders(sheet, headingIndices);
}

function writeCashflowSheets(grouped: GroupedEntries) {
    writeCashflowSheet(grouped, "Cashflow (detailed)", true);
    writeCashflowSheet(grouped, "Cashflow", false);
}