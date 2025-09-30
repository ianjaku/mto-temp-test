const TEMPACCOUNT023T2 = "aid-e28f8e47-ecd0-4fe5-b22e-efb6a624f3af";
const bindersMedia = "aid-0fb03b72-d6ed-4204-abbd-f64b8879b4a6";
const help = "aid-d38e6061-4539-488d-8bf3-204c3968f4ff";
const faulty = "faulty-account-id";

const bindersMediaRoot = "AV2KUKtPgRcJXleWPkq_";
const gettingStarted = "AWf1AjMepxPvH0YhBIWQ";
const wantToKnowMore = "AWYZocJBgRcJXleWPwG0";

const bindersMediaMember = "uid-8f94f4f3-683e-4157-87c8-1141bf3105b6";
const bindersMediaOutsider = "uid-bbcbfc4f-9452-4aed-96ce-bfa1543d9bf0";

export const testData = {
    query: "a",
    options: { maxResults: 1 },
    itemSearchOptions: { binderSearchResultOptions: { maxResults: 1 }},
    accountIds: {
        TEMPACCOUNT023T2,
        bindersMedia,
        help,
        faulty,
    },
    documents: {
        public: wantToKnowMore
    },
    collections: {
        nonPublic: bindersMediaRoot,
        public: gettingStarted,
    },
    itemFilters: {
        basic: { binderId: bindersMediaRoot },
        withAccountId: { binderId: bindersMediaRoot, accountId: bindersMedia },
        withDomain: { binderId: bindersMediaRoot, domain: "demo.manual.to" },
        forPublicDocument: { binderId: wantToKnowMore, accountId: bindersMedia },
    },
    collectionFilters: {
        basic: { ids: [bindersMediaRoot] },
        withAccountId: { ids: [bindersMediaRoot], accountId: bindersMedia },
        forPublicCollection: { ids: [gettingStarted], accountId: help },
    },
    readerItemsFilters: {
        basic: { summary: true },
        withDomain: { summary: true, domain: "demo.manual.to" },
    },
    users: {
        bindersMediaMember,
        bindersMediaOutsider,
    }
};
