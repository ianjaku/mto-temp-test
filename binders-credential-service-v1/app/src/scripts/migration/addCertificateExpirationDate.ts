import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import {
    MongoCertificateRepositoryFactory
} from "../../credentialservice/repositories/ADCertificates";
import { main } from "@binders/binders-service-common/lib/util/process";

const SCRIPT_NAME = "addCertificateExpirationDate";


main(async () => {
    const bindersConfig = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(bindersConfig, SCRIPT_NAME);
    const repositoryFactory = MongoCertificateRepositoryFactory.fromConfig(bindersConfig, logger);
    const repository = (await repositoryFactory).build(logger);
    const certificates = await repository.getAllCertificates();
    for (const certificate of certificates) {
        logger.info(`Resaving certificate for account ${certificate.accountId}`, SCRIPT_NAME);
        await repository.saveCertificate(certificate.tenantId, certificate.data, certificate.filename, certificate.accountId);
    }
});