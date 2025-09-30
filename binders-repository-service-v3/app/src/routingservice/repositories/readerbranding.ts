import * as mongoose from "mongoose";
import {
    Font,
    Logo,
    ReaderBranding,
    ReaderCssProps
} from "@binders/client/lib/clients/routingservice/v1/contract";
import { MongoRepository, MongoRepositoryFactory } from "@binders/binders-service-common/lib/mongo/repository";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";

export interface IReaderBranding extends mongoose.Document {
    id: string;
    name?: string;
    domain: string;
    logo?: Logo;
    stylusOverrides: Partial<ReaderCssProps>;
    customFonts?: Array<Font>
}

const DEFAULT_BRANDING: ReaderBranding = {
    stylusOverrideProps: {}
};

function daoToModel(dao: IReaderBranding): ReaderBranding {
    const branding: ReaderBranding = {
        stylusOverrideProps: dao.stylusOverrides ? dao.stylusOverrides : {}
    };
    branding.id = dao.id;
    if (dao.name) {
        branding.name = dao.name;
    }
    if (dao.logo) {
        branding.logo = dao.logo;
    }
    if (dao.domain) {
        branding.domain = dao.domain;
    }
    if (dao.customFonts) {
        branding.customFonts = dao.customFonts;
    }
    if (!dao.stylusOverrides.headerBgColor) {
        branding.stylusOverrideProps.headerBgColor = dao.stylusOverrides.bgDark;
    }
    return branding;
}

function modelToDao(model: ReaderBranding, domain?: string, name?: string): IReaderBranding {
    const dao: IReaderBranding = <IReaderBranding>{
        name,
        domain,
        stylusOverrides: model.stylusOverrideProps
    };
    if (model.logo !== undefined) {
        dao.logo = model.logo;
    }
    if (model.customFonts) {
        dao.customFonts = model.customFonts;
    }
    return dao;
}

const fontSchema = new mongoose.Schema(
    {
        fontFaceUrl: { type: String, required: true },
        name: { type: String, required: true }
    }
);
const customTagsSchema = new mongoose.Schema(
    {
        tag: { type: String, required: true },
        style: { type: String, required: true }
    }
);
const base64Strings = new mongoose.Schema(
    {
        small: String,
    }
);

function getReaderBrandingSchema(collectionName: string): mongoose.Schema {
    const schema = new mongoose.Schema({
        name: {
            type: String,
        },
        domain: {
            type: String,
            required: true
        },
        logo: {
            url: String,
            base64Strings: base64Strings,
            mime: String,
            size: Number,
        },
        customFonts: [fontSchema],
        stylusOverrides: {
            bgDark: { type: String },
            bgMedium: { type: String },
            customTagsStyles: [customTagsSchema],
            fgDark: { type: String },
            headerBgColor: { type: String, default: null },
            headerFontColor: { type: String },
            systemFont: { type: String },
            titleFont: { type: String },
            userFont: { type: String },
        },
        created: {
            type: Date,
            default: Date.now
        },
        updated: {
            type: Date,
            default: Date.now
        }
    }, { collection: collectionName });
    return addTimestampMiddleware(schema, "updated");
}

export interface ReaderBrandingRepository {
    createReaderBranding(branding: ReaderBranding): Promise<ReaderBranding>;
    deleteReaderBranding(brandingId: string): Promise<void>;
    getReaderBranding(domain: string): Promise<ReaderBranding>;
    getReaderBrandings(domains: string[]): Promise<ReaderBranding[]>;
    listBrandings(): Promise<Array<ReaderBranding>>;
    saveReaderBranding(domain: string, branding: ReaderBranding): Promise<void>;
    updateReaderBranding(id: string, branding: ReaderBranding): Promise<void>;
}

export class MongoReaderBrandingRepository extends MongoRepository<IReaderBranding> implements ReaderBrandingRepository {
    async createReaderBranding(branding: ReaderBranding): Promise<ReaderBranding> {
        const { domain, name } = branding;
        const dao = modelToDao(branding, domain, name);
        const query = { domain };
        const newBranding: IReaderBranding = await this.saveEntity(query, dao);
        return daoToModel(newBranding);
    }

    async getReaderBranding(domain: string): Promise<ReaderBranding> {
        const option = await this.fetchOne({ domain })
        return option.isJust() ? daoToModel(option.get()) : DEFAULT_BRANDING;
    }

    async getReaderBrandings(domains: string[]): Promise<ReaderBranding[]> {
        const daos = await this.findEntities({ domain: mongoose.trusted({ $in: domains.map(String) }) });
        return domains
            .map(domain => daos.find(d => d.domain === domain))
            .filter(d => d)
            .map(d => daoToModel(d));
    }

    async saveReaderBranding(domain: string, branding: ReaderBranding): Promise<void> {
        await this.saveEntity({ domain }, modelToDao(branding, domain));
    }

    async updateReaderBranding(id: string, branding: ReaderBranding): Promise<void> {
        const query = { _id: new mongoose.Types.ObjectId(id) };
        const update = modelToDao(branding, branding.domain, branding.name);
        await this.update(query, update);
    }

    async listBrandings(): Promise<Array<ReaderBranding>> {
        const daos = await this.findEntities({})
        return daos.map(daoToModel);
    }

    deleteReaderBranding(brandingId: string): Promise<void> {
        return this.deleteEntity({ _id: new mongoose.Types.ObjectId(brandingId) });
    }
}

export class ReaderBrandingRepositoryFactory extends MongoRepositoryFactory<IReaderBranding> {

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    build(logger: Logger) {
        return new MongoReaderBrandingRepository(this.model, this.collection, logger);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    updateModel() {
        const schema = getReaderBrandingSchema(this.collection.name);
        schema.index({ domain: 1 }, { unique: true });
        this.model = this.collection.connection.model<IReaderBranding>("ReaderBrandingDAO", schema);
    }
}
