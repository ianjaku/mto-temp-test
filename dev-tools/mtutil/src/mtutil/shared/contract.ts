export type Service = "account" |
    "authorization" |
    "credential" |
    "image" |
    "notification" |
    "public-api" |
    "repository" |
    "routing" |
    "tracking" |
    "user";

export function getClientPath(service: Service): string {
    return {
        "account": "accountservice/v1",
        "authorization": "authorizationservice/v1",
        "credential": "credentialservice/v1",
        "image": "imageservice/v1",
        "notification": "notificationservice/v1",
        "public-api": "publicapiservice/v1",
        "repository": "repositoryservice/v3",
        "routing": "routingservice/v1",
        "tracking": "trackingservice/v1",
        "user": "userservice/v1",
    }[service];
}

export function getServiceBasepath(service: Service): string {
    return {
        "account": "binders-account-service-v1/app/src/accountservice",
        "authorization": "binders-authorization-service-v1/app/src/authorization",
        "credential": "binders-credential-service-v1/app/src/credentialservice",
        "image": "binders-image-service-v1/app/src/api",
        "notification": "binders-notification-service-v1/app/src/notificationservice",
        "public-api": "binders-public-api-service-v1/app/src/public-api",
        "repository": "binders-repository-service-v3/app/src/repositoryservice",
        "routing": "binders-repository-service-v3/app/src/routingservice",
        "tracking": "binders-tracking-service-v1/app/src/trackingservice",
        "user": "binders-user-service-v1/app/src/userservice",
    }[service];
}