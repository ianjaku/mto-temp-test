import * as mongoose from "mongoose";
import { MongoRepositoryFactory } from "./repository";

export type MongoRepositoryDocument = mongoose.Document;
const register: MongoRepositoryFactory<MongoRepositoryDocument>[] = [];

export function registerFactory<T extends MongoRepositoryDocument>(factory: MongoRepositoryFactory<T>): void {
    register.push(factory as unknown as MongoRepositoryFactory<MongoRepositoryDocument>);
}

export function getFactories(): MongoRepositoryFactory<MongoRepositoryDocument>[] {
    return register;
}