import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ConfigError } from "@binders/client/lib/config/config";

/*

blocks: [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: "Azure Function Alert"
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "*Alert Name:* Internal Server Error"
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*Function name:* ${context.functionName}`
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*Environment:* ${process.env.ENVIRONMENT}`
                }
            },

            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*Date:* ${new Date().toUTCString()}`
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*Message:* ${err}`
                }
            },
            {
                type: "actions",
                elements: [
                    {
                        type: "button",
                        text: {
                            type: "plain_text",
                            text: "Check in Azure Portal"
                        },
                        url: "https://portal.azure.com",
                        style: "primary"
                    }
                ]
            }

*/


export interface SlackText {
    type: "mrkdwn" | "plain_text";
    text: string;
}


export interface SlackActionElement {
    type: "button";
    text: SlackText;
    url: string;
    style: "primary";
}


export interface SlackMessageSection {
    type: "section";
    text: SlackText;
}

export interface SlackMessageActions {
    type: "actions";
    elements: SlackActionElement[];
}

export interface SlackMessageHeader {
    type: "header";
    text: SlackText;
}

export type SlackMessageBlock = SlackMessageHeader | SlackMessageSection | SlackMessageActions;

export interface SlackMessage {
    blocks: SlackMessageBlock[];
}

export async function sendToTechtalk(message: SlackMessage) {
    const config = BindersConfig.get();
    const webhook = config
        .getString("slack.webhooks.techtalk")
        .getOrThrow(new ConfigError("Missing slack.webhooks.techtalk in config"));
    const result = await fetch(webhook, {
        method: "POST",
        body: JSON.stringify(message),
        headers: { "Content-Type": "application/json" }
    });
    if (result.status !== 200) {
        throw new Error(`Failed to send slack message: ${result.statusText}`);
    }
}