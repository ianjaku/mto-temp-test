import * as t from "tcomb";
import { tcombValidate } from "../../validation";

export const BinderCommentStruct = t.struct({
    id: t.maybe(t.String),
    threadId: t.maybe(t.String),
    userId: t.String,
    body: t.String,
    created: t.maybe(t.Date),
    updated: t.maybe(t.Date),
});

export function validateBinderComment(candidate: object): string[] {
    return tcombValidate(candidate, BinderCommentStruct);
}

