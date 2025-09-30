import * as mongoose from "mongoose";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import { Config } from "@binders/client/lib/config/config";
import { EntityNotFound } from "@binders/client/lib/clients/model";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { X509Certificate } from "crypto";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";

export interface CertificateRepository {
    saveCertificate(tenantId, t, filename, accountId): Promise<ICertificateDAO>;
    updateCertificateTenantId(accountId, tenantId): Promise<ICertificateDAO>;
    updateCertificateAccountId(tenantId, t, filename, accountId): Promise<ICertificateDAO>;
    getCertificate(accountId: string): Promise<ICertificateDAO|undefined>;
    getAllCertificates(): Promise<ICertificateDAO[]>;
}

export class CertificateNotFound extends EntityNotFound {
    constructor(accountId: string) {
        super(`Certificate for account id "${accountId}" not found`);
    }
}

export interface ICertificateDAO extends mongoose.Document {
    tenantId: string;
    data: string;
    filename: string;
    accountId: string;
    expirationDate: Date;
}


function getCertificateSchema(collectionName): mongoose.Schema {
    const schema = new mongoose.Schema(
        {
            tenantId: {
                type: String,
                required: true
            },
            data: {
                type: String,
                required: true
            },
            filename: {
                type: String,
                required: true
            },
            accountId: {
                type: String,
                required: true,
            },
            expirationDate: {
                type: Date,
                required: false
            },
            created: {
                type: Date,
                default: Date.now
            },
            updated: {
                type: Date,
                default: Date.now
            }
        },
        { collection: collectionName }
    );
    return addTimestampMiddleware(schema, "updated");
}

function expirationDateFromCert (certData: string): Date {
    const { validTo } = new X509Certificate(certData);
    return new Date(validTo);
}

export class MongoCertificateRepository extends MongoRepository<ICertificateDAO> implements CertificateRepository {
    saveCertificate(tenantId: string, cert: string, filename: string, accountId: string): Promise<ICertificateDAO> {
        const certificate = {
            tenantId,
            data: cert,
            filename,
            accountId,
            expirationDate: expirationDateFromCert(cert),
        };
        return this.saveEntity({ accountId }, certificate as ICertificateDAO);
    }

    updateCertificateAccountId(tenantId: string, cert: string, filename: string, accountId: string): Promise<ICertificateDAO> {
        const certificate = {
            tenantId,
            data: cert,
            filename,
            accountId,
            expirationDate: expirationDateFromCert(cert),
        };
        return this.saveEntity({tenantId}, certificate as ICertificateDAO);
    }

    updateCertificateTenantId(accountId: string, tenantId: string): Promise<ICertificateDAO> {
        return this.getCertificate(accountId)
            .then(certificate => {
                return this.saveCertificate(tenantId, certificate.data, certificate.filename, accountId);
            });
    }

    async getCertificate(accountId: string): Promise<ICertificateDAO | undefined> {
        const cert = await this.fetchOne({ accountId });
        if (cert.isNothing()) {
            return undefined;
        }
        return cert.get();
    }

    getAllCertificates(): Promise<ICertificateDAO[]> {
        return this.findEntities({});
    }
}

export class MongoCertificateRepositoryFactory extends MongoRepositoryFactory<ICertificateDAO> {
    build(logger: Logger): MongoCertificateRepository {
        return new MongoCertificateRepository(this.model, this.collection, logger);
    }

    protected updateModel(): void {
        const schema = getCertificateSchema(this.collection.name);
        schema.index({ accountId: 1 }, { unique: true });
        this.model = this.collection.connection.model<ICertificateDAO>("CertificateDAO", schema);
    }

    static fromConfig(config: Config, logger: Logger): Promise<MongoCertificateRepositoryFactory> {
        const loginOption = getMongoLogin("credential_service");
        return CollectionConfig.fromConfig(config, "certificates", loginOption)
            .caseOf({
                left: error => Promise.reject(error),
                right: ccfg => Promise.resolve(ccfg)
            })
            .then(collectionConfig => new MongoCertificateRepositoryFactory(collectionConfig, logger));
    }
}