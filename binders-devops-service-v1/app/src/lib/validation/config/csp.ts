import * as t from "tcomb";

const Directives = t.struct({
    childSrc: t.maybe(t.list(t.String)),
    connectSrc: t.maybe(t.list(t.String)),
    defaultSrc: t.maybe(t.list(t.String)),
    fontSrc: t.maybe(t.list(t.String)),
    formAction: t.maybe(t.list(t.String)),
    frameAncestors: t.maybe(t.list(t.String)),
    frameSrc: t.maybe(t.list(t.String)),
    imgSrc: t.maybe(t.list(t.String)),
    manifestSrc: t.maybe(t.list(t.String)),
    mediaSrc: t.maybe(t.list(t.String)),
    reportUri: t.maybe(t.list(t.String)),
    scriptSrc: t.maybe(t.list(t.String)),
    styleSrc: t.maybe(t.list(t.String)),
    workerSrc: t.maybe(t.list(t.String)),
});

const ContentSecurityPolicy = t.struct({
    directives: Directives,
    reportOnly: t.maybe(t.Boolean),
});
const False = t.refinement(t.Boolean, x => !x);

export const contentSecurityPolicy = t.union([ ContentSecurityPolicy, False ]);
contentSecurityPolicy.dispatch = (value: unknown) => typeof value === "boolean" ? False : ContentSecurityPolicy;