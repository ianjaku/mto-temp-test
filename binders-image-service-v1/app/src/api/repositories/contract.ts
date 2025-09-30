import * as mongoose from "mongoose";
import {
    IOriginalVisualData,
    IVisualFilter,
    ImageRotation,
    VisualFitBehaviour,
    VisualStatus,
    VisualUsage
} from "@binders/client/lib/clients/imageservice/v1/contract";
import {
    Image,
    StreamingInfo,
    Video,
    VideoIdentifier,
    Visual,
    VisualFormat,
    VisualIdentifier
} from "../model";
import { Update } from "@binders/binders-service-common/lib/mongo/repository";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";
import { omit } from "ramda";

export interface VisualDAO extends mongoose.Document {
    imageId: string;
    originalVisualData?: IOriginalVisualData;
    binderId: string;
    fileName: string;
    extension: string;
    md5: string;
    mime: string;
    status: string;
    created: Date;
    formats: VisualFormat[];
    isDeleted: boolean;
    reprocessCount?: number;
    streamingInfo?: StreamingInfo;

    usage: VisualUsage;

    // Metadata for BinderChunk Usage
    fitBehaviour?: string;
    languageCodes?: string[];
    bgColor?: string;
    rotation?: number;
    autoPlay?: boolean;
    audioEnabled?: boolean;
    // Metadata for ReaderComment Usage
    commentId?: string;
    hasAudio?: boolean;
}

export const VisualFormatSchema = new mongoose.Schema({
    format: {
        type: Number,
        required: true
    },
    width: {
        type: Number,
        required: true,
        min: 0
    },
    height: {
        type: Number,
        required: true,
        min: 0
    },
    size: {
        type: Number,
        required: true,
        min: 0
    },
    storageLocation: {
        type: String
    },
    storageLocationPreBitmovin: {
        type: String
    },
    container: {
        type: String,
    },
    containerPreBitmovin: {
        type: String
    },
    durationInMs: {
        type: Number
    },
    videoCodec: {
        type: Number
    },
    audioCodec: {
        type: Number
    },
    keyFramePosition: {
        type: Number,
        default: null
    }
});


export const OriginalVisualSchema = new mongoose.Schema({
    originalId: {
        type: String,
        required: true
    },
    binderId: {
        type: String,
        required: true,
    }
});

export const StreamingInfoSchema = new mongoose.Schema({
    manifestPaths: {
        type: [String],
        required: true
    },
    contentKeyId: {
        type: String,
        required: true
    },
    streamingHostname: {
        type: String,
        required: true,
    },
    manifestPathsPreBitmovin: {
        type: [String],
    },
    contentKeyIdPreBitmovin: {
        type: String,
    },
    streamingHostnamePreBitmovin: {
        type: String,
    },
})

export function getScheme(
    collectionName: string,
): mongoose.Schema {
    const schema = new mongoose.Schema({
        imageId: { type: String, require: true },
        binderId: { type: String, require: true },
        fileName: { type: String, require: true },
        extension: { type: String, require: true },
        md5: { type: String, require: true },
        mime: { type: String },
        status: { type: String, require: true },
        formats: { type: [VisualFormatSchema], require: true },
        created: { type: Date, default: Date.now },
        updated: { type: Date, default: Date.now },
        reprocessCount: { type: Number },
        isDeleted: { type: Boolean, default: false },
        originalVisualData: { type: OriginalVisualSchema, require: false },
        streamingInfo: { type: StreamingInfoSchema },

        // Default null because old videos were not processed with this field
        hasAudio: { type: Boolean, default: null },

        // All visuals before this key was added were binder visuals
        usage: { type: String, default: VisualUsage.BinderChunk },

        fitBehaviour: { type: String, require: true },
        audioEnabled: { type: Boolean, require: false, default: false, },
        autoPlay: { type: Boolean, default: true },
        bgColor: { type: String, require: true },
        rotation: { type: Number, require: false, default: 0 },
        languageCodes: { type: [String], require: false },
        commentId: { type: String, },
    }, { collection: collectionName });
    schema.index({ binderId: 1, md5: 1 });
    schema.index({ binderId: 1, md5: 1, commentId: 1 }, { unique: true });
    schema.index({ binderId: 1, imageId: 1 }, { unique: true });
    schema.index({ binderId: 1 });
    schema.index({ imageId: 1 });
    schema.index({ status: 1 });
    schema.index({ "originalVisualData.binderId": 1, "originalVisualData.originalId": 1 });
    return addTimestampMiddleware(schema, "updated");
}

export function modelToDao(visual: Visual): Record<string, unknown> {
    return {
        ...omit(["id"], visual),
        fileName: visual.filename,
        imageId: (<VisualIdentifier>visual.id).value(),
        isDeleted: false
    };
}

export function daoToModel(dao: VisualDAO): Visual {
    const id = VisualIdentifier.parse(dao.imageId);
    const model = {
        id,
        originalVisualData: dao.originalVisualData as IOriginalVisualData,
        binderId: dao.binderId,
        filename: dao.fileName,
        extension: dao.extension,
        md5: dao.md5,
        mime: dao.mime,
        status: dao.status as VisualStatus,
        created: dao.created,
        formats: dao.formats,
        reprocessCount: dao.reprocessCount,
        streamingInfo: dao.streamingInfo,
        hasAudio: dao.hasAudio,

        usage: dao.usage,

        fitBehaviour: dao.fitBehaviour as VisualFitBehaviour,
        bgColor: dao.bgColor,
        languageCodes: dao.languageCodes,
        rotation: dao.rotation,
        audioEnabled: dao.audioEnabled,
        autoPlay: dao.autoPlay,

        commentId: dao.commentId
    };
    return id instanceof VideoIdentifier ?
        model as Video :
        model as Image;
}

export interface VisualUpdate {
    status?: VisualStatus;
    extraFormats?: VisualFormat[];
    replaceFormats?: VisualFormat[];
    mime?: string;
    streamingInfo?: StreamingInfo;

    autoPlay?: boolean;
    fitBehaviour?: VisualFitBehaviour;
    bgColor?: string;
    languageCodes?: string[];
    rotation?: number;
    audioEnabled?: boolean;
}

export function visualToMongoUpdate(update: VisualUpdate): Update {
    if (update.extraFormats && update.replaceFormats) {
        throw new Error("Invalid update requested. (both extraFormats and replaceFormats)");
    }
    const mongoUpdate = {};
    function updateSet(field, value) {
        // eslint-disable-next-line no-prototype-builtins
        if (!mongoUpdate.hasOwnProperty("$set")) {
            mongoUpdate["$set"] = {};
        }
        mongoUpdate["$set"][field] = value;
    }
    if (update.status) {
        updateSet("status", update.status);
    }
    if (update.extraFormats) {
        Object.assign(mongoUpdate, { $addToSet: { formats: { $each: update.extraFormats } } });
    }
    if (update.fitBehaviour) {
        updateSet("fitBehaviour", update.fitBehaviour);
    }
    if (update.bgColor) {
        updateSet("bgColor", update.bgColor);
    }
    if (update.languageCodes) {
        updateSet("languageCodes", update.languageCodes);
    }
    if (update.replaceFormats) {
        updateSet("formats", update.replaceFormats);
    }
    if (update.mime) {
        updateSet("mime", update.mime);
    }
    if (update.rotation !== undefined) {
        updateSet("rotation", update.rotation);
    }
    if (update.audioEnabled !== undefined) {
        updateSet("audioEnabled", update.audioEnabled);
    }
    if (update.autoPlay != null) {
        updateSet("autoPlay", update.autoPlay);
    }
    if (update.streamingInfo) {
        updateSet("streamingInfo", update.streamingInfo);
    }
    return mongoUpdate;
}

export interface VisualCreationAttributes {
    visualId: VisualIdentifier;
    binderId: string;
    fileName: string;
    extension: string;
    md5: string;
    mime: string;
    status: VisualStatus;
    original: VisualFormat;
    hasAudio?: boolean;

    usage: VisualUsage;

    fitBehaviour?: string;
    bgColor?: string;
    languageCodes?: string[];
    rotation?: ImageRotation;
    audioEnabled?: boolean;
    autoPlay?: boolean;

    commentId?: string,
}

export interface VisualRepository {
    createVisual(visualCreationAttributes: VisualCreationAttributes): Promise<Visual>;

    deleteVisual(binderId: string, visualId: VisualIdentifier): Promise<void>;
    softDeleteVisuals(binderId: string, visualIds: VisualIdentifier[]): Promise<number>;

    hardDeleteVisual(binderId: string, visualId: VisualIdentifier): Promise<void>;
    hardDeleteVisuals(filter: { binderIds: string[]}): Promise<void>;

    getVisual(binderId: string, visualId: VisualIdentifier): Promise<Visual>;

    findVisuals(visualFilter: IVisualFilter): Promise<Visual[]>;

    getVisualWithMD5AndCommentId(binderId: string, md5: string, commendId?: string): Promise<Visual>;

    listBinderVisuals(
        binderId: string,
        usage: VisualUsage,
        options?: { ignoreStatus?: boolean }
    ): Promise<Array<Visual>>;

    restoreVisual(binderId: string, visualId: VisualIdentifier, filename?: string): Promise<void>;

    updateVisual(binderId: string, visualId: VisualIdentifier, update: VisualUpdate): Promise<Visual>;

    saveVisual(visual: Visual): Promise<Visual>;
    getImageIdByOriginalVisualData(originalBinderId: string, originalVisualId: string, binderId: string): Promise<Visual>
    getAllVisualsByOriginalVisualData(originalBinderId: string, originalVisualId: string): Promise<Visual[]>;

    getBinderIdsForVisualIds(visualIds: string[]): Promise<string[]>;
}
