import * as R from "ramda";
import {
    createSecretClient,
    deleteSecret,
    getSecret,
    getSecretNameFromBranch,
    updateSecret
} from "./secret";
import { InvocationContext } from "@azure/functions";
import { KeyVaultSecret } from "@azure/keyvault-secrets";

interface Branch {
    name: string
}
export type BitbucketPullRequestInfo = {
    pullrequest: {
        destination: {
            branch: Branch
        },
        source: {
            branch: Branch
        }
    }
}

function mergeSecrets(context: InvocationContext, sourceBranchSecret: KeyVaultSecret, destinationBranchSecret: KeyVaultSecret): Record<string, unknown> {
    const parsedSourceSecret = JSON.parse(sourceBranchSecret.value)

    let parsedDestinationSecret
    if (!destinationBranchSecret) {
        context.log(`Missing destination secret value: ${destinationBranchSecret}`)
        parsedDestinationSecret = {}
    } else {
        parsedDestinationSecret = JSON.parse(destinationBranchSecret.value)
    }

    if (parsedSourceSecret && parsedDestinationSecret) {
        context.log("Merging secrets")
        return R.mergeDeepLeft(parsedSourceSecret, parsedDestinationSecret)
    }
    return null
}

export async function handleMergeInKeyVault(context: InvocationContext, keyVaultName: string, sourceSecretName: string, destinationSecretName: string) {
    const client = createSecretClient(keyVaultName)

    const sourceBranchSecret = await getSecret(context, client, sourceSecretName)
    if (!sourceBranchSecret) {
        context.log(`Source secret "${sourceSecretName}" not found`)
        return
    }

    const destinationBranchSecret = await getSecret(context, client, destinationSecretName)

    const mergedSecret = mergeSecrets(context, sourceBranchSecret, destinationBranchSecret)
    if (mergedSecret) {
        await updateSecret(client, destinationSecretName, mergedSecret)
        if (sourceSecretName.startsWith("mt") || sourceSecretName.startsWith("MT")) {
            await deleteSecret(client, sourceSecretName)
        }
    }
}

export function parseHttpRequest(ctx: InvocationContext, body: BitbucketPullRequestInfo) {
    if (!body.pullrequest) {
        ctx.error({ req: JSON.stringify(body) })
        throw new Error("Missing body")
    }
    const pr = body.pullrequest
    const destinationBranchName = pr?.destination?.branch?.name
    const sourceBranchName = pr?.source?.branch?.name

    if (destinationBranchName && sourceBranchName) {
        return {
            sourceSecretName: getSecretNameFromBranch(sourceBranchName),
            destinationSecretName: getSecretNameFromBranch(destinationBranchName)
        }
    }

    ctx.error({ req: JSON.stringify(body) })
    throw new Error("Missing destination or source branch info")
}