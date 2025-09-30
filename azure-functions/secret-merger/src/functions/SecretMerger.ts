import { BitbucketPullRequestInfo, handleMergeInKeyVault, parseHttpRequest } from "../lib/merge";
import { HttpRequest, HttpResponseInit, InvocationContext, app } from "@azure/functions";

export async function SecretMerger(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);
    const body = await request.json()
    const { sourceSecretName, destinationSecretName } = parseHttpRequest(context, body as BitbucketPullRequestInfo )
    context.log(`Successfuly parsed body, source secert is ${sourceSecretName}, destination secret is ${destinationSecretName}`)
    const keyVaultsToProcess = ["binderdevbindersmedia","binderstgbindersmedia","binderprodbindersmedia"]
    for (const keyVaultName of keyVaultsToProcess) {
        context.log(`Processing keyvault: ${keyVaultName}`)
        await handleMergeInKeyVault(context, keyVaultName, sourceSecretName, destinationSecretName)
    }
    return {
        status: 200
    };
}

app.http("SecretMerger", {
    methods: ["GET", "POST"],
    authLevel: "function",
    handler: SecretMerger
});
