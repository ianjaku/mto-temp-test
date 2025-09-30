import { IValidationEnv } from "./types";
import ag5 from "./config/ag5";
import { akita } from "./config/akita";
import azure from "./config/azure";
import bitmovin from "./config/bitmovin";
import { contentSecurityPolicy } from "./config/csp";
import devops from "./config/devops";
import elasticsearch from "./config/elasticsearch";
import gemini from "./config/gemini";
import { getBackupStruct } from "./config/backup";
import helm from "./config/helm";
import hubspot from "./config/hubspot";
import intercom from "./config/intercom";
import launchDarkly from "./config/launchdarkly";
import logging from "./config/logging";
import mailgun from "./config/mailgun";
import mongo from "./config/mongo";
import msTransactableOffers from "./config/msTransactableOffers";
import pipedrive from "./config/pipedrive";
import posthog from "./config/posthog";
import proxy from "./config/proxy";
import rabbit from "./config/rabbit";
import redis from "./config/redis";
import s3 from "./config/s3";
import serviceconfig from "./config/serviceconfig";
import services from "./config/services";
import session from "./config/session";
import slack from "./config/slack";
import tally from "./config/tally";
import translator from "./config/translator";
import video from "./config/video";


// eslint-disable-next-line @typescript-eslint/no-var-requires
const t = require("tcomb");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const validate = require("tcomb-validation").validate;

const environmentBackups = {
    local: getBackupStruct("local"),
    production: getBackupStruct("production"),
    staging: getBackupStruct("staging"),
};

const configStruct = (env: IValidationEnv) => t.struct({
    azure: azure(env),
    bitmovin,
    devops,
    elasticsearch: elasticsearch(env),
    gluster: t.maybe(t.Object),
    helm,
    gemini,
    intercom,
    hubspot,
    launchDarkly,
    logging,
    mailgun,
    mongo: mongo(env),
    msTransactableOffers: msTransactableOffers(env),
    pipedrive,
    proxy,
    rabbit: rabbit(env),
    redis: redis(env),
    s3: s3(env),
    serviceconfig,
    services,
    session: session(env),
    slack,
    translator,
    video,
    backup: environmentBackups[env],
    akita: akita(env),
    contentSecurityPolicy,
    posthog,
    tally,
    ag5,
}, { strict: true });

export default function(config: unknown, env: IValidationEnv): void {
    const result = validate(config, configStruct(env));
    if (!result.isValid()) {
        const errors = result.errors.map((err: Error) => `Validation error in ${env} environment: ${err.message}\n`);
        throw new Error(errors.concat(" "));
    }
}
