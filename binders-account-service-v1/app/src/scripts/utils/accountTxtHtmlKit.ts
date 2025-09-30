import { Child, Table, span, style, td, tr } from "@binders/binders-service-common/lib/mail/txtHtmlKit";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";

function AccountProp({ caption, value }) {
    return tr([
        td(caption, style("label", "accountsLeftColumn")),
        td(value, style("value")),
    ]);
}
  
function AccountPropName({ name }) {
    return tr(td(name, style("value", "fullWidth")))
}
  
function AccountPropDate({ caption, value, dist }) {
    return tr([
        td(span(caption), style("label")),
        td([
            span(dist, style("value")),
            span(` (${value})`, style("label")),
        ])
    ])
}

type AccountStats = Omit<Account, "created" | "expirationDate" | "readerExpirationDate"> & {
    age: number;
    editorExpiresIn: number;
    readerExpiresIn: number;
    created: string;
    expirationDate: string;
    readerExpirationDate: string;
    readerExpiresAt: string;
    editorExpiresAt: string;
    createdAt: string;
};

export function Account(props: AccountStats): Child {
    const {
        createdAt, created, expirationDate, id, name,
        readerExpirationDate, subscriptionType,
        editorExpiresAt, readerExpiresAt
    } = props;
    return Table([
        AccountPropName({ name }),
        tr(td(Table([
            AccountProp({ caption: "ID", value: id }),
            AccountProp({ caption: "Subscription", value: subscriptionType }),
            AccountPropDate({ caption: "Created", value: created, dist: createdAt }),
            AccountPropDate({ caption: "Editor Expires", value: expirationDate, dist: editorExpiresAt }),
            AccountPropDate({ caption: "Reader Expires", value: readerExpirationDate, dist: readerExpiresAt }),
        ], style("gapSmall"))))
    ]);
}
