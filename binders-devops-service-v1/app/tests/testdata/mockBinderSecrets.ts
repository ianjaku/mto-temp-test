import { BindersSecrets } from "../../src/lib/bindersconfig";
import { createMockFactory } from "../util";

export const mockBinderSecrets: BindersSecrets = {
    api: {
        "secret": "TPfPY3Uhjfy9NxMZ2GU9vreBKDKzfm6VMtcxrpTKscp9WRqvXsr2uBPZHYfsVsKDm58DBvs3wbmPKESpXy9Jp2XPgRummNNThzpjuxTVRPT4PErC94fdWdVAr6CFqECe",
    },
    azure: {
        "blobs": {
            "fonts": {
                "accessKey": "videoAccessKey",
                "account": "manualtodevfonts",
                "container": "fonts"
            },
            "logos": {
                "accessKey": "videoAccessKey",
                "account": "manualtodevfonts",
                "container": "logos"
            },
            "mongobackups": {
                "accessKey": "videoAccessKey",
                "account": "manualtodevbackup",
                "container": "mongobackups"
            },
            "elasticbackups": {
                "accessKey": "videoAccessKey",
                "account": "manualtodevbackup",
                "container": "elasticbackups"
            },
            "images": {
                "accessKey": "videoAccessKey",
                "account": "manualtodevvisuals",
                "container": "images"
            },
            "audio": {
                "accessKey": "videoAccessKey",
                "account": "manualtodevaudio",
                "container": "audio"
            },
            "videos": {
                "accessKey": "videoAccessKey",
                "account": "manualtodevvideos"
            }
        },
        "functions": {
            "screenshots": "https://manualto-dev-take-screenshot.azurewebsites.net/api/screenshots?code=ntaXav2lVl43Ci7APGCOEaaUL4pG6ocriviaT8QHNS9V2w2ZmtsD2A=="
        },
        "locationCode": "westeurope",
        "servicePrincipal": {
            "devops": {
                "login": "login",
                "password": "password"
            }
        },
        "subscription": {
            "id": "id",
            "tenantId": "tenantId"
        },
        "translator": {
            "subscriptionKey": "subscriptionKey"
        },
        "videoIndexer": {
            "apiRoot": "https://api.videoindexer.ai",
            "accountId": "09ece2da-24b2-4e40-9662-352fe02d2f56",
            "accountName": "binderdevbinders",
            "resourceGroup": "binder-dev-resource-group",
            "productAuthorizationSubscriptionPrimaryKey": "productAuthorizationSubscriptionPrimaryKey"
        },
        "cognitiveServices": {
            "speechServiceAccessKey": "speechServiceAccessKey"
        },
        "cdn": {
            "attachment": "manualto-dev-attachments-cdn.azureedge.net",
            "audio": "manualto-dev-audio-cdn.azureedge.net",
            "images": "manualto-dev-images-cdn.azureedge.net",
            "videos": "manualto-dev-videos-cdn.azureedge.net"
        },
        openAi: {
            apiKey: "AZURE_OPENAI_API_KEY",
            endpoint: "https://manualtoopenaitest.openai.azure.com/",
        },
    },
    bitmovin: {
        apiKey: "someValue"
    },
    google: {
        cloudTranslation: {
            "apiKey": "googleSecret"
        }
    },
    deepl: {
        cloudTranslation: {
            "apiKey": "deeplSecret"
        }
    },
    backend: {
        "jwt": "jwtSecret"
    },
    certManager: {
        "awsAccessKey": "",
        "awsSecretKey": ""
    },
    devops: {
        "user": {
            "login": "login",
            "password": "password"
        },
        "bitbucket": {
            "accessToken": "accessToken"
        }
    },
    gemini: {
        apiKey: "geminiApiKey",
    },
    helm: {
        "tls": {
            "ca": {
                "key": "",
                "cert": ""
            }
        }
    },
    launchDarkly: {
        "clientSideId": "clientId",
        "sdkKey": "sdkKey"
    },
    intercom: {
        "appId": "",
        "secretKey": ""
    },
    hubspot: {
        apiToken: "",
        portalId: ""
    },
    mailgun: {
        "apiKey": "mailgunApiKey"
    },
    msTransactableOffers: {
        "azureSSOAppID": "appId",
        "azureSSORedirectURI": "http://localhost:30019/azure-ad-sso/redirect",
        "azureSSOAuthority": "https://login.microsoftonline.com/common",
        "useStub": true
    },
    pipedrive: {
        "apiKey": "somekey"
    },
    rabbit: {
        login: "",
        password: ""
    },
    s3: {
        "videos": {
            "accessKey": "",
            "bucket": "",
            "region": "",
            "transcoderRegion": "",
            "secret": ""
        }
    },
    servicePrincipal: {
        "clientId": "clientId",
        "secretKey": "spkey"
    },
    session: {
        "secret": "session"
    },
    slack: {
        "webhooks": {
            "techtalk": "webhookURL,"
        }
    },
    tally: {
        "plgSignupWebhookSignSecret": "example sign secret",
    },
    posthog: {
        publicKey: "some key"
    },
    ag5: {
        baseUrl: "https://ag5base.url",
        apiKey: "some-key",
    }
}

export const mockBinderSecretsFactory = createMockFactory(mockBinderSecrets)
