/* eslint-disable no-console */
import { readFileSync, writeFileSync } from "fs";

const getOptions = () => {
    if (process.argv.length !== 3) {
        console.error(`Usage: node ${__filename} <CSV_FILE>`);
        process.exit(1);
    }
    return {
        csvFile: process.argv[2]
    };
};

const buildCandidates = () => {
    const result = [];
    for (let i=0; i<26; i++) {
        result.push(String.fromCharCode("A".charCodeAt(0)+i));
        result.push(String.fromCharCode("a".charCodeAt(0)+i));
    }
    for (let i=0; i<10; i++) {
        result.push(String.fromCharCode("0".charCodeAt(0)+i));
    }
    return result;
}

const DELIMITER = ";";
const PASSWORD_LENGTH = 12;
const candidates = buildCandidates();

const generatePassword = () => {
    const passwordKeys = [];
    for (let i=0; i<PASSWORD_LENGTH; i++) {
        const randomIndex = Math.floor(Math.random() * candidates.length);
        passwordKeys.push(candidates[randomIndex]);
    }
    return passwordKeys.join("");
}

const doIt = async () => {
    const { csvFile } = getOptions();
    const inputLines = readFileSync(csvFile)
        .toString()
        .split("\n");
    const outputLines = [ inputLines[0] ];
    for(let i = 1; i < inputLines.length; i++) {
        const line = inputLines[i];
        const [email, password] = line.split(DELIMITER);
        if (password) {
            outputLines.push(line);
        } else {
            if (!email) {
                continue;
            }
            outputLines.push(`${email}${DELIMITER}${generatePassword()}`);
        }
    }
    writeFileSync(csvFile, outputLines.join("\n") + "\n");
}

doIt().then(
    () => {
        console.log("All done!");
        process.exit(0);
    },
    err => {
        console.error(err);
        process.exit(1);
    }
)