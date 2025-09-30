import { InvocationContext } from "@azure/functions";
import axios from "axios";

export async function sendSlackNotification(context: InvocationContext, err: unknown): Promise<void> {
    const slackWebhookUrl: string = process.env.SLACK_WEBHOOK_URL;
    const messagePayload = {
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
        ]
    };
    try {
        await axios.post(slackWebhookUrl, messagePayload);
    } catch (error) {
        context.log("Error sending message to Slack:", error);
    }
}