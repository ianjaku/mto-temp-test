import * as chalk from "chalk";
import { realpath, writeFile } from "fs/promises";
import { compile } from "json-schema-to-typescript";

const { bold, green } = chalk;

// eslint-disable-next-line no-console
const log = console.log

const DOCKER_COMPOSE_SPEC_URL = "https://raw.githubusercontent.com/compose-spec/compose-spec/refs/heads/main/schema/compose-spec.json";

const BANNER = `
/**
 * This file was automatically generated on ${new Date().toISOString()}
 * from ${DOCKER_COMPOSE_SPEC_URL}
 * DO NOT MODIFY IT BY HAND.
 * To re-generate the types, run
 * yarn workspace @binders/devops-v1 dc:types
 */
`;

async function doIt() {
    const typesFile = "./src/dc/docker-compose-spec.d.ts";
    log(`Downloading docker-compose JSON schema from ${bold(DOCKER_COMPOSE_SPEC_URL)}`)
    const schema = await fetch(DOCKER_COMPOSE_SPEC_URL)
        .then(res => res.json());
    log("Transforming JSON schema to TS types");
    const types = await compile(schema, "DockerComposeSpecification", {
        bannerComment: BANNER,
        style: {
            jsxSingleQuote: false,
            semi: true,
            singleQuote: false,
            tabWidth: 4,
            useTabs: false,
        }
    })
    await writeFile(typesFile, types);
    log(`Saved to ${bold(await realpath(typesFile))}`);
    log(green("Finished"));
}

// eslint-disable-next-line no-console
doIt().catch(console.error);
