import { Authorization } from "../middleware/authorization";
import { Config } from "@binders/client/lib/config";
import { TallyWebhookPayload } from "@binders/client/lib/clients/publicapiservice/v1/contract";
import { Unauthorized } from "@binders/client/lib/clients/model";
import { createHmac } from "crypto";

export function TallyAuthorization(config: Config): Authorization {
    return async req => {
        if (req.user?.isBackend) return;
        const tallySignature = req.header("tally-signature")
        if (!tallySignature) {
            throw new Unauthorized("Missing signature");
        }
        const payloadSignature = calculatePayloadSignature(config, req.body)
        if (payloadSignature !== tallySignature) {
            throw new Unauthorized("Invalid signature");
        }
    }
}

// https://tally.so/help/webhooks#2101522b05e44eec8b823f7651cf6cc3
export function calculatePayloadSignature(config: Config, payload: unknown) {
    const maybeSigningSecret = config.getString("tally.plgSignupWebhookSignSecret");
    if (maybeSigningSecret.isNothing()) {
        throw new Error("BindersConfig is missing Tally webhook secret")
    }
    const signingSecret = maybeSigningSecret.get();
    return createHmac("sha256", signingSecret)
        .update(JSON.stringify(payload))
        .digest("base64");
}

export function getTallyField(
    type: TallyWebhookPayload["data"]["fields"][0]["type"],
    label: string,
    tallyPayload: TallyWebhookPayload,
): string | undefined {
    return tallyPayload.data.fields.find(f => f.type === type && f.label === label)?.value
}
