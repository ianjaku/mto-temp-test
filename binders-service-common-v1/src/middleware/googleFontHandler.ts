import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getGoogleFontContent } from "../util/googlefonts";

const today = new Date().toISOString().split("T")[0];
const googleFontsFileName = (name): string => path.join(os.tmpdir(), `${name}-${today}.txt`);

const writeGoogleFontsFile = async (name: string, data: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        return fs.writeFile(googleFontsFileName(name), data, err => {
            return err ? reject(err) : resolve();
        });
    });
}

const readGoogleFontsFile = async (name: string): Promise<string> => {
    return new Promise(resolve => {
        fs.readFile(googleFontsFileName(name), "utf8", async (err, data) => {
            return err ? resolve(undefined) : resolve(data);
        })
    })
}

const fetchFontFromGoogle = async (fontName: string, fontType: "css" | "icon", fontParameters?: string): Promise<string> => {
    return <string> (await getGoogleFontContent(fontName, undefined, fontType, fontParameters));
}

export const getGoogleFontCss = async (fontName: string, fontType: "css" | "icon", fontParameters?: string): Promise<string> => {
    const name = `${fontType}-${fontName}`;
    const googleFontFromFile = await readGoogleFontsFile(name);
    if (googleFontFromFile) {
        return googleFontFromFile;
    }
    const googleFontFromGoogle = await fetchFontFromGoogle(fontName, fontType, fontParameters);
    await writeGoogleFontsFile(name, googleFontFromGoogle);
    return googleFontFromGoogle;
}

