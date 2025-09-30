import * as mongoose from "mongoose";

export function addTimestampMiddleware(schema: mongoose.Schema, field: string): mongoose.Schema {
    return schema
        .pre("save", function(next) {
            this[field] = new Date();
            next();
        })
        .pre("updateMany", function(next) {
            this.updateMany({}, { $set: { [field]: new Date() } });
            next();
        })
        .pre("updateOne", function(next) {
            this.updateOne({}, { $set: { [field]: new Date() } });
            next();
        })
        .pre("findOneAndUpdate", function(next) {
            this.findOneAndUpdate({}, { $set: { [field]: new Date() } });
            next();
        });
}
