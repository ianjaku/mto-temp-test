import { JWT } from "google-auth-library";
import { loadJSON } from "../json";
import { sheets_v4 } from "@googleapis/sheets";

const toRGBColour = (color: string): sheets_v4.Schema$Color => {
    if (color === "orange") {
        return {
            red: 1,
            green: 0.65,
            blue: 0
        };
    }
    if (color === "white") {
        return {
            red: 1,
            green: 1,
            blue: 1
        };
    }
    return {
        red: 0,
        green: 0,
        blue: 0
    };
}
const toCellValue = (cell: CellValue): sheets_v4.Schema$CellData => {
    if (isPlainCell(cell)) {
        return {
            userEnteredValue: {
                stringValue: cell
            }
        };
    } else {
        return {
            userEnteredValue: {
                stringValue: cell.value
            },
            userEnteredFormat: {
                backgroundColor: toRGBColour(cell.color),
                wrapStrategy: "WRAP"
            }
        };
    }
}

export const toSheetStringsRow = (values: CellValue[]): sheets_v4.Schema$RowData => {
    return {
        values: values.map(v => toCellValue(v))
    };
}

export const getJWTClient = async (keyFile: string): Promise<JWT> => {
    const keyFileContents = await loadJSON(keyFile);
    const client = new JWT({
        email: keyFileContents["client_email"],
        key: keyFileContents["private_key"],
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    await client.authorize();
    return client;
}

export interface CellWithBackground {
    value: string;
    color: string
}

export interface CellWithWarning extends CellWithBackground {
    color: "orange"
}

export type PlainCell = string;
export type CellValue = PlainCell | CellWithBackground;

export const isPlainCell = (cell: CellValue): cell is PlainCell => typeof cell === "string";

export function toBatchUpdateCells (start: sheets_v4.Schema$GridCoordinate, values: CellValue[][]): sheets_v4.Schema$Request {
    return {
        updateCells: {
            start,
            fields: "*",
            rows: values.map(row => toSheetStringsRow(row))
        }
    }
}

export const extractRowCount = (range: string): number => {
    if(!range) {
        return 0;
    }
    const [, rangeEnd] = range.split(":Z");
    return Number.parseInt(rangeEnd, 10);
}
