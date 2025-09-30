import * as mongoose from "mongoose";
import { CollectionConfig, ConnectionConfig } from "./config";
import { Logger } from "../util/logging";

export class Collection {

    connection: mongoose.Connection;
    name: string;
    hasConnected: boolean;

    private static connect(connectionConfig: ConnectionConfig): mongoose.Connection {
        const connectionString = connectionConfig.toConnectionString();
        const connectionOptions = connectionConfig.getConnectOptions();
        return mongoose.createConnection(connectionString, connectionOptions);
    }

    /** Use {@link Collection.build} instead */
    private constructor(config: CollectionConfig, logger: Logger) {
        this.hasConnected = false;
        this.connect(config, logger);
    }

    private connect(config: CollectionConfig, logger: Logger): void {
        this.connection = Collection.connect(config.connectionConfig);
        const collection = `${config.connectionConfig.database}.${config.collectionName}`;
        const setConnected = (() => this.hasConnected = true).bind(this);
        const setDisconnected = (() => this.hasConnected = false).bind(this);
        const getConnected = (() => this.hasConnected).bind(this);
        this.connection.on("error", async (error) => {
            logger.error(`mongo connection error ${collection}`, "mongo-error", { error });
        });
        this.connection.on("disconnected", () => {
            logger.info(`mongo disconnected ${collection}`, "mongo-disconnect");
            if (!getConnected()) {
                logger.fatal("Thanks mongoose and goodbye", "mongoose-is-horrible");
                process.exit(1);
            }
            setDisconnected();
        });
        this.connection.on("connected", () => {
            logger.info(`mongo connected ${collection}`, "mongo-connect");
            setConnected();
        });
        this.name = config.collectionName;
    }

    static build(config: CollectionConfig, logger: Logger): Collection {
        return new Collection(config, logger);
    }
}
