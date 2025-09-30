import * as mongoose from "mongoose";
import {
    MongoRepository,
    MongoRepositoryFactory,
    SearchOptions
} from "@binders/binders-service-common/lib/mongo/repository";
import { Logger } from "@binders/binders-service-common/lib/util/logging"
import { ScriptRunStat } from "../models/scriptrunstats"

export interface ScriptRunStatRepository {
    insertScriptRunStat(stat: ScriptRunStat): Promise<ScriptRunStat>;
    listScriptStats(scriptName: string): Promise<Array<ScriptRunStat>>;
    getLatestScriptStats(scriptName: string): Promise<ScriptRunStat>;
}

export interface IScriptRunStat extends mongoose.Document {
    scriptName: string;
    runDateTime: Date;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
}

function scriptRunStatDaoToModel(scriptRunStat: IScriptRunStat): ScriptRunStat {
    return new ScriptRunStat(scriptRunStat.scriptName, scriptRunStat.runDateTime, scriptRunStat.data);
}

function scriptRunStatModelToDao(scriptRunStat: ScriptRunStat): IScriptRunStat {
    return <IScriptRunStat>{
        scriptName: scriptRunStat.scriptName,
        runDateTime: scriptRunStat.runDateTime,
        data: scriptRunStat.data,
    };
}

function getScriptRunStatSchema(collectionName): mongoose.Schema {
    return new mongoose.Schema({
        scriptName: {
            type: String,
            required: true
        },
        runDateTime: {
            type: Date,
            required: true,
            default: Date.now
        },
        data: {
            type: Array,
            required: false
        },
    }, { collection: collectionName } );
}

export class MongoScriptRunStatRepositoryFactory extends MongoRepositoryFactory<IScriptRunStat> {

    protected updateModel(): void {
        const schema = getScriptRunStatSchema(this.collection.name);
        this.model = this.collection.connection.model<IScriptRunStat> ("ScriptRunStatDAO", schema);
    }
    build(logger: Logger):MongoScriptRunStatRepository {
        return new MongoScriptRunStatRepository(this.model, this.collection, logger);
    }
}

export class MongoScriptRunStatRepository extends MongoRepository<IScriptRunStat> implements ScriptRunStatRepository {
    insertScriptRunStat(scriptRunStat: ScriptRunStat): Promise<ScriptRunStat> {
        return this.insertEntity( scriptRunStatModelToDao(scriptRunStat))
            .then(storedResult => scriptRunStatDaoToModel(storedResult));
    }

    listScriptStats(scriptName: string): Promise<Array<ScriptRunStat>> {
        return this.findEntities({scriptName})
            .then(daos => daos.map(scriptRunStatDaoToModel));
    }

    getLatestScriptStats(scriptName: string): Promise<ScriptRunStat> {
        const options: SearchOptions = {
            orderByField: "runDateTime",
            sortOrder: "descending",
            limit: 1
        }
        return this.findEntities({scriptName}, options)
            .then((daos) =>  daos.length > 0 ? scriptRunStatDaoToModel(daos.pop()) : undefined)
    }
}