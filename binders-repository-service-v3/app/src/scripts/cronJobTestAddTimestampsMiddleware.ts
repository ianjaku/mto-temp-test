/* eslint-disable no-console */
import * as mongoose from "mongoose";
import {
    ConnectionConfig,
    HostWithPort,
    getMongoLogin,
} from "@binders/binders-service-common/lib/mongo/config";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";

type IFoo = {
    key: string;
    value: number;
    created: Date;
    updated: Date;
}

async function doIt() {
    const connection = createTestConnection();
    try {
        const schema = addTimestampMiddleware(new mongoose.Schema({
            key: {
                type: String,
                required: true
            },
            value: {
                type: Number,
            },
            created: {
                type: Date,
                default: Date.now
            },
            updated: {
                type: Date,
                default: Date.now
            },
        }, { collection: "foo" } ), "updated");
        schema.index({ key: 1 }, { unique: true })

        const FooModel = connection.model<IFoo> ("FooDAO", schema);
        await FooModel.deleteMany({ key: "bar" });

        console.log("Testing Model.save()")
        const obj = new FooModel({ key: "bar", value: 1 })
        const original = await obj.save()
        let previousUpdated = original.updated;
        if (original.updated == undefined) throw new Error("Field updated was not populated")

        console.log("Testing Model.findOneAndUpdate()")
        await FooModel.findOneAndUpdate({ key: "bar" }, { value: 2 })
        await new Promise(resolve => setTimeout(resolve, 10))
        const foundOneAndUpdatedObj = await FooModel.findOne({ key: "bar" });
        if (foundOneAndUpdatedObj.value !== 2) throw new Error("Field value was not updated")
        if (foundOneAndUpdatedObj.updated.getTime() === previousUpdated.getTime()) throw new Error("Field updated was not updated")
        previousUpdated = foundOneAndUpdatedObj.updated

        console.log("Testing Model.updateOne()")
        await FooModel.updateOne({ key: "bar" }, { value: 3 });
        await new Promise(resolve => setTimeout(resolve, 10))
        const updatedOneObj = await FooModel.findOne({ key: "bar" });
        if (updatedOneObj.value !== 3) throw new Error("Field value was not updated")
        if (updatedOneObj.updated.getTime() === previousUpdated.getTime()) throw new Error("Field updated was not updated")
        previousUpdated = updatedOneObj.updated

        console.log("Testing Model.updateMany()")
        await FooModel.updateMany({ key: "bar" }, { $set: { value: 4 }});
        await new Promise(resolve => setTimeout(resolve, 10))
        const updatedObj = await FooModel.findOne({ key: "bar" });
        if (updatedObj.value !== 4) throw new Error("Field value was not updated")
        if (updatedObj.updated.getTime() === previousUpdated.getTime()) throw new Error("Field updated was not updated")
        previousUpdated = updatedObj.updated

        console.log("Testing Model.findOneAndUpdate(filter, update, { new: true, upsert: true })")
        await FooModel.findOneAndUpdate({ key: "bar" }, { value: 5 }, { new: true, upsert: true });
        await new Promise(resolve => setTimeout(resolve, 10))
        const upsertedObj = await FooModel.findOne({ key: "bar" });
        if (upsertedObj.value !== 5) throw new Error("Field value was not updated")
        if (upsertedObj.updated.getTime() === previousUpdated.getTime()) throw new Error("Field updated was not updated")
        previousUpdated = upsertedObj.updated

        await FooModel.deleteMany({ key: "bar" });
    } finally {
        await connection.close()
    }
}

function createTestConnection() {
    const config = BindersConfig.get();
    const database = "repository_service"
    // arbitrary collection in the database
    const collectionKey = "mongo.collections.checklists"
    const cluster = config.getString(collectionKey + ".cluster").get()
    const clusterKey = "mongo.clusters." + cluster;
    const connectionConfig = new ConnectionConfig(
        config.getArray<HostWithPort>(clusterKey + ".instances").get(),
        getMongoLogin(database),
        config.getString("mongo.credentials." + database),
        database,
        config.getString(clusterKey + ".replicaSet"),
        undefined,
    );
    const connectionString = connectionConfig.toConnectionString();
    const connectionOptions = connectionConfig.getConnectOptions();
    const connection = mongoose.createConnection(connectionString, connectionOptions);
    return connection;
}

doIt()
    .then(() => console.log("OK"))
    .catch(e => { console.error(e); process.exit(1); })
