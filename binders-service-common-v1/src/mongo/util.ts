/**
 * Checks if an error is a MongoDB duplicate key error.
 *
 * MongoDB throws a duplicate key error (error code 11000) when attempting to insert
 * or update a document that would violate a unique index constraint.
 *
 * @param err - The error object to check
 * @returns `true` if the error is a MongoDB duplicate key error, `false` otherwise
 */
export const isMongoDuplicateKeyError = (err): boolean =>
    err.name === "MongoServerError" && err.code === 11000;
