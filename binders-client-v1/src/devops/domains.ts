
export const WILDCARD_DOMAIN_SETTINGS = [
    {
        domain: "*.api.binders.media",
    },
    {
        domain: "*.be.editor.manual.to",
        test: "veritas.be.editor.manual.to",
    },
    {
        domain: "*.be.manual.to",
        test: "veritas.be.manual.to"
    },
    {
        domain: "*.editor.manual.to",
        test: "test.editor.manual.to"
    },
    {
        domain: "*.manual.to",
        test: "test.manual.to"
    },
    {
        domain: "*.telltree.com",
    },
    {
        domain: "*.binders.media",
        test: "elastic.binders.media"
    },
];

export const WILDCARD_DOMAINS = WILDCARD_DOMAIN_SETTINGS
    .map( ({ domain }) => domain);


export const isValidAccountDomain = (domain: string): boolean => {
    return WILDCARD_DOMAINS.some(wildcardDomain => {
        if (wildcardDomain.includes("editor")) return false;
        const regexString = wildcardDomain
            .replace("*", "^[a-z0-9-]+")
            .replace(/\./g, "\\.");
        const regex = new RegExp(regexString + "$", "i");
        return regex.test(domain);
    });
}
