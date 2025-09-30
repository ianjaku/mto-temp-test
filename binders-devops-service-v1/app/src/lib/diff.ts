import * as R from "ramda";
import { inspect } from "util";
import { log as libLog } from "../lib/logging";


// eslint-disable-next-line @typescript-eslint/no-var-requires
const readline = require("readline");

const isObject = R.compose(R.equals("Object"), R.type);
const allAreObjects = R.compose(R.all(isObject), R.values);
const hasLeft = R.has("left");
const hasRight = R.has("right");
const hasBoth = R.both(hasLeft, hasRight);
const allEqual = R.cond([
    [R.isEmpty, R.always(true)],
    [R.T, (x: unknown[]) => !!R.reduce(
        (res, i) => R.equals(res, i) ? i : R.reduced(false),
        x[0],
        x,
    )],
]);
const valuesAreEqual = R.compose(allEqual, R.values);
const isEqual = R.both(hasBoth, valuesAreEqual);

const markAdded = R.compose(R.append(undefined), R.values);
const markRemoved = R.compose(R.prepend(undefined), R.values);
const isAddition = R.both(hasLeft, R.complement(hasRight));
const isRemoval = R.both(R.complement(hasLeft), hasRight);

const objectDiff = R.curry(_diff);
function _diff(l, r) {
    return R.compose(
        R.map(R.cond([
            [isAddition, markAdded],
            [isRemoval, markRemoved],
            [hasBoth, R.ifElse(
                allAreObjects,
                R.compose(R.apply(objectDiff), R.values),
                R.values)
            ]
        ])),
        R.reject(isEqual),
        R.useWith(R.mergeWith(R.mergeRight), [R.map(R.objOf("left")), R.map(R.objOf("right"))])
    )(l, r);
}

export function getChar(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise( resolve => {
        rl.question(question, (answer) => {
            resolve(answer);
            rl.close();
        });
    });
}


// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function configDiff(env, currentVaultSecrets, currentLocalSecrets, dryRun): Promise<boolean> {
    const log = msg => libLog(msg, "");
    const diff = objectDiff(currentVaultSecrets, currentLocalSecrets);
    if (Object.keys(diff).length === 0) {
        log(`No changes to be made for env ${env}.`);
        return false;
    }
    log(`\nProceeding will make the following changes to env ${env}:\n\n`);
    log(inspect(diff, { colors: true, compact: false, depth: null }));
    log("\n\n");
    if (dryRun) {
        process.exit(0);
    }
    const char = await getChar("Do you want to proceed? (y/*)\n");
    if (char !== "y") {
        log("Aborting...");
        process.exit(1);
    }
    return true;
}

export default objectDiff;


