import { ACMClient, ImportCertificateCommand } from "@aws-sdk/client-acm";
import {
    CloudFrontClient,
    CreateDistributionCommand,
    GetDistributionConfigCommand,
    ListDistributionsCommand,
    MinimumProtocolVersion,
    SSLSupportMethod,
    UpdateDistributionCommand
} from "@aws-sdk/client-cloudfront";
import { Env, parseEnv } from "../../lib/environment";
import { createCoreV1Api, createKubeConfig } from "../../actions/k8s-client/util";
import { info, panic } from "@binders/client/lib/util/cli";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import { WILDCARD_DOMAINS } from "@binders/client/lib/devops/domains";
import { main } from "../../lib/program";
import { setupAksAccess } from "../../service/aks/access";


const AWS_REGION = "us-east-1"
const S3_DOMAIN_ORIGIN = "manualto-prod-down.s3.eu-central-1.amazonaws.com"
const acm = new ACMClient({ region: AWS_REGION });
const cloudfrontClient = new CloudFrontClient({ region: AWS_REGION });

const SCRIPT_NAME = "Sync tls secret with AWS";

const program = new Command();

program
    .name(SCRIPT_NAME)
    .description("This script is responsible uploading tls certificate into AWS")
    .option("-n, --namespace <namespace>", "Namespace in which script will fetch tls secret")
    .option("-c, --clusterName <clusterName>", "AKS cluster name")
    .option("-e, --environment <env>", "Environment, just staging or production values allowed")
program.parse(process.argv);
const options: ScriptOptions = program.opts();

type ScriptOptions = {
    clusterName?: string;
    namespace?: string;
    environment?: Env
};

function getDomainsForEnv(env: Env): string[] {
    return env === "production" ? WILDCARD_DOMAINS : ["*.staging.binders.media"]
}

async function fetchCertificate(clusterName: string, namespace: string, secret: string) {
    const kc = await createKubeConfig(clusterName, { useAdminContext: true });
    const k8sApi = await createCoreV1Api(kc);
    const certData = await k8sApi.readNamespacedSecret({ name: secret, namespace });
    const certificate = Buffer.from(certData.data["tls.crt"], "base64");
    const privateKey = Buffer.from(certData.data["tls.key"], "base64");
    return {
        certificate,
        privateKey
    }
}

async function importCertificate(certificate: Buffer, privateKey: Buffer) {
    // Split the certificate data into individual certificate blocks.
    // The AWS ACM `ImportCertificateCommand` requires that the main (end-entity) certificate
    // and intermediate certificates (certificate chain) be provided separately:
    //
    // - The `Certificate` field should contain only the end-entity certificate, also called the "leaf" certificate.
    // - The `CertificateChain` field should contain any intermediate certificates, which help establish trust
    //   between the end-entity certificate and trusted root certificates.
    //
    const certParts = certificate.toString().split("-----END CERTIFICATE-----\n");

    const endEntityCertificate = certParts[0] + "-----END CERTIFICATE-----\n";

    const certificateChain = certParts.slice(1).join("-----END CERTIFICATE-----\n").trim();

    const importCommand = new ImportCertificateCommand({
        Certificate: Buffer.from(endEntityCertificate),
        PrivateKey: privateKey,
        CertificateChain: certificateChain ? Buffer.from(certificateChain) : undefined, // Only add chain if it exists
    });
    let response
    try {
        response = await acm.send(importCommand);
    } catch (error) {
        panic(`Error during certificate import: ${error}`)
    }
    return response.CertificateArn
}

async function findOrCreateCloudFrontDistribution(certArn: string, environment: Env) {
    const listCommand = new ListDistributionsCommand({});
    const distributions = await cloudfrontClient.send(listCommand);

    const matchingDist = distributions.DistributionList?.Items?.find(
        (dist) => dist.Comment === environment
    );

    if (matchingDist) {
        await updateCloudFrontDistribution(matchingDist.Id, certArn);
    } else {
        await createCloudFrontDistribution(certArn, environment);
    }
}

async function updateCloudFrontDistribution(distId: string, certArn: string) {
    const getConfigCommand = new GetDistributionConfigCommand({ Id: distId });
    const getConfigResponse = await cloudfrontClient.send(getConfigCommand);

    const currentCertArn = getConfigResponse.DistributionConfig.ViewerCertificate?.ACMCertificateArn;
    if (currentCertArn === certArn) {
        info(`Certificate ARN is already up to date for distribution ${distId}. No update needed.`);
        return;
    }

    const updateCommand = new UpdateDistributionCommand({
        Id: distId,
        IfMatch: getConfigResponse.ETag,
        DistributionConfig: {
            ...getConfigResponse.DistributionConfig,
            ViewerCertificate: {
                ACMCertificateArn: certArn,
                SSLSupportMethod: SSLSupportMethod.sni_only,
                MinimumProtocolVersion: MinimumProtocolVersion.TLSv1_1_2016
            }
        },
    });

    try {
        const updateResponse = await cloudfrontClient.send(updateCommand);
        info(`Updated CloudFront distribution with ID: ${distId}`, updateResponse.Distribution?.Id);
    } catch (error) {
        panic(`Error updating CloudFront distribution: ${error}`);
    }

}

async function createCloudFrontDistribution(certArn: string, environment: Env) {
    info(`Started creation cloudfront distribution for ${environment} environment and certificate ${certArn}`)
    const id = "S3-manualto-prod-down"
    const domains = getDomainsForEnv(environment)
    const createCommand = new CreateDistributionCommand({
        DistributionConfig: {
            CallerReference: `${Date.now()}`,
            DefaultRootObject: "index.html",
            Origins: {
                Quantity: 1,
                Items: [{
                    Id: id,
                    DomainName: S3_DOMAIN_ORIGIN,
                    S3OriginConfig: {
                        OriginAccessIdentity: ""
                    }
                }]
            },
            DefaultCacheBehavior: {
                ForwardedValues: {
                    QueryString: false,
                    Cookies: {
                        Forward: "none"
                    }
                },
                TargetOriginId: id,
                ViewerProtocolPolicy: "redirect-to-https",
                MinTTL: 0,
                MaxTTL: 300
            },
            ViewerCertificate: {
                ACMCertificateArn: certArn,
                SSLSupportMethod: SSLSupportMethod.sni_only,
            },
            Enabled: true,
            Comment: environment,
            Aliases: {
                Quantity: domains.length,
                Items: domains
            }
        },
    });

    try {
        const createResponse = await cloudfrontClient.send(createCommand);
        info(`Created new CloudFront distribution for ${environment}:`, createResponse.Distribution?.Id);
    } catch (error) {
        panic(`Error creating CloudFront distribution: ${error}`);
    }
}

function getTlsSecretName(environment: Env) {
    return environment === "production" ? "tls-production-secret" : "tls-staging-secret"
}

async function syncCertificate(clusterName: string, environment: Env, namespace: string) {
    const secretName = getTlsSecretName(environment)
    info(`Start fetching tls certificate from cluster ${clusterName}`)
    const { certificate, privateKey } = await fetchCertificate(clusterName, namespace, secretName)
    info("Start acm certificate import")
    const certificateArn = await importCertificate(certificate, privateKey)
    info(`Import completed. Arn: ${certificateArn}`)
    await findOrCreateCloudFrontDistribution(certificateArn, environment)
}

main(async () => {
    if (!options.clusterName) {
        panic("You need to provide aks clusterName e.g: -n clusterName")
    }

    if (!options.namespace) {
        panic("You need to provide some namespace e.g: -n develop")
    }

    if (!options.environment) {
        panic("You need to provide some environment e.g: -e production")
    }

    const config = BindersConfig.get();
    await setupAksAccess(config, options.clusterName)

    const env = parseEnv(options.environment)
    await syncCertificate(options.clusterName, env, options.namespace)
})