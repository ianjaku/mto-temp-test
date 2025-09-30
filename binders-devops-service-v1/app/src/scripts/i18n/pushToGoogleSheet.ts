import {
    CellValue,
    getJWTClient,
    isPlainCell,
    toBatchUpdateCells
} from  "../../lib/googleapis/sheets";
import {
    SPREADSHEET_ID,
    autoDimension,
    getOptions,
    isMT,
    loadTranslations,
    pullTranslations,
    shouldContinue,
    validateBranch,
    validatePushChanges
} from  "./googlesheet/util";
import log from "../../lib/logging";
import { main } from "../../lib/program";
import { sheets as sheetsApi } from "@googleapis/sheets";



const countMachineTranslations = (translations: string[]) => {
    let count = 0;
    for( let i = 1; i < translations.length; i++)  {
        if (isMT(translations[i])) {
            count++;
        }
    }
    return count;
}

function prioritizeMT(left, right) {
    const leftMTCount = countMachineTranslations(left);
    const rightMTCount = countMachineTranslations(right);
    return rightMTCount - leftMTCount;
}

const buildCell = (value: CellValue): CellValue => {
    const color = isMT(value) ? "orange" : "white";
    if (isPlainCell(value)) {
        return {
            value,
            color
        }
    } else {
        return {
            value: value.value,
            color
        }
    }
}

main( async () => {
    const { privateKey } = getOptions();
    await validateBranch();
    const client = await getJWTClient(privateKey);
    const sheets = sheetsApi({ version: "v4", auth: client });
    const localTranslations = await loadTranslations();
    const languages = Object.keys(localTranslations);
    const tKeys = Object.keys(localTranslations.en_US);
    const pulledTranslations = await pullTranslations(sheets, languages, tKeys);
    const { changedLanguages, errors } = await validatePushChanges(localTranslations, pulledTranslations);
    if (changedLanguages.length + errors.length > 0) {
        if (errors.length > 0) {
            log("\n\n\n!!! VALIDATION ERRORS !!!\n");
            log(JSON.stringify(errors, null, 2));
        }
        await shouldContinue();
    } else {
        log("No changes detected");
        return;
    }
    const numberOfRows = Object.keys(pulledTranslations.en_US).length;
    const requests = [];
    if (numberOfRows < tKeys.length + 1) {
        requests.push({
            insertDimension: {
                range: {
                    sheetId: 0,
                    dimension: "ROWS",
                    startIndex: 0,
                    endIndex: tKeys.length - numberOfRows + 1
                }
            }
        })
    }
    const headers = ["", ...languages];
    const rows = tKeys.map( k => [
        k,
        ...languages.map(l => {
            if (!localTranslations[l][k]) {
                log(`L: ${l}, K: ${k}`);
            }
            return buildCell(localTranslations[l][k])
        })
    ]);
    rows.sort(prioritizeMT);
    const values = [
        headers,
        ...rows
    ];
    const start = {
        sheetId: 0,
        rowIndex: 0,
        columnIndex: 0
    };
    requests.push(toBatchUpdateCells(start, values));
    requests.push(autoDimension(values.length));
    await sheets.spreadsheets.values.batchClear({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
            ranges: [`Sheet1!A1:Z${numberOfRows + 10000}`]
        }
    });
    await sheets.spreadsheets.batchUpdate({
        requestBody: {
            includeSpreadsheetInResponse: false,
            responseIncludeGridData: false,
            responseRanges: [],
            requests
        },
        spreadsheetId: SPREADSHEET_ID
    });

});
