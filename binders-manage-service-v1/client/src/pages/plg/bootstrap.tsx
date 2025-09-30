import * as React from "react";
import type { Binder, DocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../../components/dialog";
import { Fragment, useEffect, useMemo, useState } from "react";
import { toastStyles, useToast } from "../../components/use-toast";
import {
    useBootstrapUser,
    useCollectionElementsWithInfo,
    useListAccounts,
    useTemplateCollectionsList,
} from "../../api/hooks";
import type { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { ContentTitleRow } from "../maintitle";
import FontAwesome from "react-fontawesome";
import { Input } from "../../components/input";
import { Search } from "../../components/search";
import { cn } from "../../cn";
import { useAnimateVisibility } from "@binders/client/lib/react/helpers/hooks";
import { validateEmailInput } from "@binders/client/lib/clients/validation";

const formCardStyles = "flex flex-row gap-2 p-2 md:min-w-sm cursor-pointer hover:bg-muted rounded-sm transition-colors";
const listContainerStyles = "flex flex-col gap-4 p-2";
const listStyles = "flex flex-col max-h-96 overflow-y-auto";
const labelStylesAlignTop = "md:justify-self-end self-start mt-2";
const labelStylesAlignCenter = "md:justify-self-end md:self-center";
const cardStylesMuted = "bg-transparent border-transparent shadow-none hover:border-border";

const DEFAULT_PLG_ACCOUNT_DOMAIN = "trial.manual.to";
const DEFAULT_PLG_TEMPLATE_COLLECTION = "Template (Copy this for new accounts)";

export const PlgBootstrap = () => {
    const queryParams = useRawQueryParams()
    const allAccounts = useListAccounts();
    const [account, setAccount] = useState<Account | undefined>();
    const [userEmail, setUserEmail] = useState(queryParams.get("email") ?? "");
    const [userFirstName, setUserFirstName] = useState(queryParams.get("firstName") ?? "");
    const [userLastName, setUserLastName] = useState(queryParams.get("lastName") ?? "");
    const firstName = decodeURIComponent(queryParams.get("firstName") ?? "");
    const lastName = decodeURIComponent(queryParams.get("lastName") ?? "");
    const defaultCompanyName = firstName.length + lastName.length > 0 ? `${[firstName, lastName].join(" ")}'s Home Collection` : "";
    const [companyName, setCompanyName] = useState(defaultCompanyName);
    const [templateCollection, setTemplateCollection] = useState<DocumentCollection | undefined>();
    const [isEmailConfirmed, setIsEmailConfirmed] = useState(false);
    const [isAccountConfirmed, setIsAccountConfirmed] = useState(false);
    const [isCollectionConfirmed, setIsCollectionConfirmed] = useState(false);
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
    const allCollections = useTemplateCollectionsList(account?.id);
    const {
        isVisible: isSuccessViewVisible,
        setVisibility: setSuccessViewVisibiity,
        shouldRender: shouldSuccessViewRender,
    } = useAnimateVisibility(false);
    const { toast } = useToast();
    const bootstrapUser = useBootstrapUser({
        onError: e => {
            toast({ className: toastStyles.error, title: "Failed to bootstrap user", description: e.message })
        },
        onSuccess: () => {
            setSuccessViewVisibiity(true);
            toast({
                className: toastStyles.info,
                title: "Bootstrap successful",
                description: <>User <strong>{userEmail}</strong> was set up to use <strong>{account.name}</strong></>,
            });
        },
    });

    const isEmailValid = useMemo(() => validateEmailInput(userEmail ?? "").length === 0, [userEmail]);
    const isFirstNameValid = userFirstName.length > 1
    const isLastNameValid = userLastName.length > 1
    const isConfirmed = isEmailConfirmed && isAccountConfirmed && isCollectionConfirmed;
    const isSubmitEnabled = isFirstNameValid && isLastNameValid && isEmailValid && companyName.length && account && templateCollection && isConfirmed;
    const isSubmitting = bootstrapUser.isLoading;

    const submit = () => {
        bootstrapUser.mutate({
            trialAccountId: account.id,
            login: userEmail,
            firstName: userFirstName,
            lastName: userLastName,
            companyName: companyName,
            templateCollectionId: templateCollection.id,
        })
    };

    const reset = () => {
        setSuccessViewVisibiity(false);
        setCompanyName("");
        setUserEmail("");
        setUserFirstName("");
        setUserLastName("");
        setAccount(undefined);
        setTemplateCollection(undefined);
    }

    useEffect(() => {
        const trialAccount = allAccounts.data?.find(acc => acc.domains.some(d => d === DEFAULT_PLG_ACCOUNT_DOMAIN));
        if (trialAccount && !account) setAccount(trialAccount);
    }, [account, allAccounts.data]);

    useEffect(() => {
        const col = allCollections.data?.find(acc => acc.titles.some(t => t.title.startsWith(DEFAULT_PLG_TEMPLATE_COLLECTION)));
        if (col && !templateCollection) setTemplateCollection(col);
    }, [templateCollection, allCollections.data]);

    return (
        <div className="flex flex-col relative">
            <ContentTitleRow title="Setup a new user" />
            <Card className={cn(
                "flex flex-col",
                "md:grid grid-flow-row grid-cols-2-max-1fr md:items-center",
                "gap-4 me-2 md:p-6 md:min-w-md md:max-w-5xl bg-transparent shadow-none border-none"
            )}>

                <label htmlFor="userEmail" className={labelStylesAlignCenter}>Email address</label>
                <div className="relative">
                    <Input
                        id="userEmail"
                        className="bg-white py-2 px-4 h-auto"
                        value={userEmail}
                        onChange={e => {
                            setUserEmail(e.currentTarget.value);
                            setIsEmailConfirmed(false);
                            setIsAccountConfirmed(false);
                        }}
                        placeholder="Email address"
                    />
                    <ClearIcon className="top-1/2 -translate-y-1/2" enabled={userEmail?.length > 0} onClick={() => setUserEmail("")} />
                    <StatusIcon valid={isEmailValid} />
                </div>

                <label htmlFor="userFirstName" className={labelStylesAlignCenter}>First name</label>
                <div className="relative">
                    <Input
                        id="userFirstName"
                        className="bg-white py-2 px-4 h-auto"
                        value={userFirstName}
                        onChange={e => {
                            setUserFirstName(e.currentTarget.value);
                            setIsEmailConfirmed(false);
                            setIsAccountConfirmed(false);
                        }}
                        placeholder="First name"
                    />
                    <ClearIcon className="top-1/2 -translate-y-1/2" enabled={userFirstName?.length > 0} onClick={() => setUserFirstName("")} />
                    <StatusIcon valid={isFirstNameValid} />
                </div>

                <label htmlFor="userLastName" className={labelStylesAlignCenter}>Last name</label>
                <div className="relative">
                    <Input
                        id="userLastName"
                        className="bg-white py-2 px-4 h-auto"
                        value={userLastName}
                        onChange={e => {
                            setUserLastName(e.currentTarget.value);
                            setIsEmailConfirmed(false);
                            setIsAccountConfirmed(false);
                        }}
                        placeholder="Last name"
                    />
                    <ClearIcon className="top-1/2 -translate-y-1/2" enabled={userLastName?.length > 0} onClick={() => setUserLastName("")} />
                    <StatusIcon valid={isLastNameValid} />
                </div>

                <label htmlFor="companyName" className={labelStylesAlignCenter}>Company name</label>
                <div className="relative">
                    <Input
                        id="companyName"
                        className="bg-white py-2 px-4 h-auto"
                        value={companyName}
                        onChange={e => {
                            setCompanyName(e.currentTarget.value);
                            setIsCollectionConfirmed(false);
                        }}
                        placeholder="Name of the company"
                    />
                    <ClearIcon className="top-1/2 -translate-y-1/2" enabled={companyName?.length > 0} onClick={() => setCompanyName("")} />
                    <StatusIcon valid={companyName?.length > 0} />
                </div>

                <div className="h-px bg-border col-span-2 my-2" />

                <label htmlFor="accountId" className={labelStylesAlignTop}>Account</label>
                <Dialog modal open={isAccountModalOpen} onOpenChange={setIsAccountModalOpen}>
                    <DialogTrigger asChild>
                        <div className="relative">
                            <AccountView account={account} className={cardStylesMuted} />
                            <StatusIcon valid={account != null} />
                        </div>
                    </DialogTrigger>
                    <DialogContent className="w-full md:w-2xl max-w-screen">
                        <DialogHeader className="flex flex-col gap-2">
                            <DialogTitle>Choose account</DialogTitle>
                            <DialogDescription>
                                Search for an account where the user should be invited to.
                            </DialogDescription>
                        </DialogHeader>
                        <AccountsList onItemClick={acc => {
                            setAccount(acc);
                            setTemplateCollection(undefined);
                            setIsAccountConfirmed(false);
                            setIsCollectionConfirmed(false);
                            setIsAccountModalOpen(false);
                        }} />
                    </DialogContent>
                </Dialog>

                <div className="h-px bg-border col-span-2 my-2" />

                <label htmlFor="templateCollectionId" className={labelStylesAlignTop}>Template collection</label>
                <div className="flex flex-col gap-2">
                    <Dialog modal open={isCollectionModalOpen} onOpenChange={setIsCollectionModalOpen}>
                        <DialogTrigger asChild>
                            <div className="relative">
                                <CollectionView collection={templateCollection} className={cardStylesMuted} />
                                <StatusIcon valid={templateCollection != null} />
                            </div>
                        </DialogTrigger>
                        <DialogContent className="w-fit md:w-fit md:min-w-2xl max-w-screen">
                            <DialogHeader className="flex flex-col gap-2">
                                <DialogTitle>Choose collection</DialogTitle>
                                <DialogDescription>
                                    Search for a collection to be duplicated as the users home collection
                                </DialogDescription>
                            </DialogHeader>
                            <CollectionList accountId={account?.id} onItemClick={col => {
                                setTemplateCollection(col);
                                setIsCollectionConfirmed(false);
                                setIsCollectionModalOpen(false);
                            }} />
                        </DialogContent>
                    </Dialog>
                </div>

                <label className={labelStylesAlignTop}>Confirm</label>
                <div className="flex flex-col gap-2">
                    <div className="relative">
                        <div className="flex flex-col gap-2 mt-2 ms-4">
                            <div className="flex flex-row items-center gap-4 relative">
                                <Input
                                    id="confirmationEmail"
                                    className="bg-white w-5 h-5"
                                    type="Checkbox"
                                    disabled={!isEmailValid}
                                    checked={isEmailConfirmed}
                                    onChange={e => setIsEmailConfirmed(e.currentTarget.checked)}
                                />
                                <StatusIcon valid={isEmailConfirmed} />
                                <label htmlFor="confirmationEmail" className="">Email <strong>{userEmail}</strong> is reviewed</label>
                            </div>
                            <div className="flex flex-row items-center gap-4 relative">
                                <Input
                                    id="confirmationAccount"
                                    className="bg-white w-5 h-5"
                                    type="Checkbox"
                                    checked={isAccountConfirmed}
                                    disabled={!isEmailValid || !account}
                                    onChange={e => setIsAccountConfirmed(e.currentTarget.checked)}
                                />
                                <StatusIcon valid={isAccountConfirmed} />
                                <label htmlFor="confirmationAccount" className="">
                                    The user will gain <strong>login</strong> access to account <strong>{account?.name}</strong> on <strong>{account?.domains.map(d => d.replace(/manual.to$/, "editor.manual.to")).join(", ")}</strong>
                                </label>
                            </div>
                            <div className="flex flex-row items-center gap-4 relative">
                                <Input
                                    id="confirmationCollection"
                                    className="bg-white w-5 h-5"
                                    type="Checkbox"
                                    disabled={!companyName.length || !templateCollection}
                                    checked={isCollectionConfirmed}
                                    onChange={e => setIsCollectionConfirmed(e.currentTarget.checked)}
                                />
                                <StatusIcon valid={isCollectionConfirmed} />
                                <label htmlFor="confirmationCollection" className="">The user will gain <strong>editor</strong> access to collection <strong>{companyName}</strong></label>
                            </div>
                        </div>
                    </div>
                </div>

                <Button
                    variant="default"
                    disabled={!isSubmitEnabled || isSubmitting}
                    className="md:col-span-2 mt-4 justify-self-end"
                    onClick={submit}
                ><FontAwesome className={isSubmitting ? "animate-spin" : ""} name={isSubmitting ? "spinner" : "save"} /><strong>{isSubmitting ? "Working" : "Submit"}</strong></Button>

            </Card>
            {shouldSuccessViewRender ?
                (
                    <div className={cn(
                        "bootstrap-success absolute z-20 inset-0 transition max-w-5xl bg-background",
                        "flex flex-col items-center justify-center gap-8",
                        isSuccessViewVisible ? "opacity-100" : "opacity-0",
                    )}>
                        <FontAwesome name="check-circle" className="text-accent" style={{ fontSize: "64px" }} />
                        <p>User <strong>{userEmail}</strong> has been set up to use <strong>{account?.name}</strong></p>
                        <div className="flex flex-row gap-2">
                            <Button variant="link" onClick={() => setSuccessViewVisibiity(false)}>
                                <FontAwesome name="arrow-left" />Go Back
                            </Button>
                            <Button onClick={reset}>
                                <FontAwesome name="repeat" />Repeat
                            </Button>
                        </div>
                    </div>
                ) :
                null}
        </div>
    );
}

const CollectionDetailView = ({ collection }: { collection?: DocumentCollection }) => {
    const ids = collection.elements.map(e => e.key);
    const elements = useCollectionElementsWithInfo(collection.accountId, ids)
    const items = useMemo(() => {
        return elements.data ?? [];
    }, [elements.data])
    const loadingView = elements.isLoading ? <>Loading...</> : null;
    const errorView = elements.isError ? <>Error while loading: {JSON.stringify(elements.error)}</> : null;
    const emptyView = elements.isSuccess && items.length === 0 ? <NoResults>No documents found in collection</NoResults> : null;
    return (
        <div className={cn(listContainerStyles, "cursor-default")}>
            <div className="grid grid-cols-2-max-1fr items-center gap-x-2 gap-y-1 max-h-96 overflow-y-auto">
                {loadingView ?? errorView ?? emptyView ??
                    items.map(item => {
                        if ((item as DocumentCollection).kind === "collection") {
                            const col = item as unknown as DocumentCollection;
                            return <Fragment key={col.id}>
                                <FontAwesome name="folder-o" /><span>{col.titles?.map(t => t.title).join(" ")}</span>
                            </Fragment>
                        } else if ((item as { kind: string }).kind === "document") {
                            const binder = item as unknown as Binder;
                            return <Fragment key={binder.id}>
                                <FontAwesome name="file-text-o" /><span>{binder.languages?.at(0)?.storyTitle}</span>
                            </Fragment>
                        }
                        return <Fragment key={item.id}>
                            <span /><span>Unknown item {item.id}</span>
                        </Fragment>
                    })}
            </div>
        </div>
    )
}

const AccountsList = (props: { onItemClick: (acc: Account) => void }) => {
    const [filter, setFilter] = useState("");
    const accounts = useListAccounts();
    const filteredAccounts = useMemo(() => {
        const lcFilter = filter.toLowerCase();
        return accounts.data?.filter(acc => acc.domains.some(d => d.toLowerCase().includes(lcFilter)) || acc.name?.toLowerCase().includes(lcFilter)) ?? [];
    }, [filter, accounts.data])
    const loadingView = accounts.isLoading ? <>Loading...</> : null;
    const errorView = accounts.isError ? <>Error while loading: {JSON.stringify(accounts.error)}</> : null;
    const emptyView = accounts.isSuccess && filteredAccounts.length === 0 ? <NoResults>No results found for <strong>{filter}</strong></NoResults> : null;
    return (
        <div className={listContainerStyles}>
            <Search id="search-account" value={filter} setValue={setFilter} />
            {loadingView ?? errorView ?? emptyView ??
                <div className={listStyles}>
                    {filteredAccounts.map(acc => (
                        <AccountView
                            key={acc.id}
                            account={acc}
                            onClick={() => props.onItemClick(acc)}
                        />
                    ))}
                </div>}
        </div>
    )
}

const CollectionList = (props: { accountId: string; onItemClick: (tpl: DocumentCollection) => void }) => {
    const [filter, setFilter] = useState("");
    const templateCollections = useTemplateCollectionsList(props.accountId);
    const filteredTemplateCollections = useMemo(() => {
        const lcFilter = filter.toLowerCase();
        return templateCollections.data?.filter(u => u.titles.some(t => t.title.toLowerCase().includes(lcFilter))) ?? [];
    }, [filter, templateCollections.data])
    const loadingView = templateCollections.isLoading ? <>Loading...</> : null;
    const errorView = templateCollections.isError ? <>Error while loading: {JSON.stringify(templateCollections.error)}</> : null;
    const emptyView = templateCollections.isSuccess && filteredTemplateCollections.length === 0 ? <NoResults>No results found for <strong>{filter}</strong></NoResults> : null;
    return (
        <div className={listContainerStyles}>
            <Search id="search-collection" value={filter} setValue={setFilter} />
            {loadingView ?? errorView ?? emptyView ??
                <div className={listStyles}>
                    {filteredTemplateCollections.map(u => (
                        <CollectionView
                            key={u.id}
                            collection={u}
                            onClick={() => props.onItemClick(u)}
                            minimal
                        />
                    ))}
                </div>
            }
        </div>
    )
}

function AccountView({ account, className, onClick }: { account: Account; className?: string; onClick?: () => void }) {
    return (
        <Card onClick={onClick} className={cn(
            formCardStyles,
            account ? "text-gray-700" : "text-gray-500 hover:text-gray-700",
            className,
        )}>
            <div className="flex items-center justify-center w-8 h-8">
                <FontAwesome name="at" style={{ fontSize: "24px" }} />
            </div>
            {account ?
                <div className="flex flex-col break-all">
                    <strong className="">{account?.name}</strong>
                    {account?.domains.length ?
                        <span className="text-sm">{account?.domains.join(" ")}</span> :
                        <span className="text-warning text-sm inline-flex gap-1 items-center">
                            <FontAwesome name="exclamation-triangle" />Account has no domains
                        </span>}
                </div> :
                <span className="flex flex-col justify-center">Click to select account</span>}
        </Card>
    )
}

function CollectionView({ className, collection, minimal, onClick }: { collection: DocumentCollection; className?: string; minimal?: boolean; onClick?: () => void; }) {
    const collectionEmptyView = !minimal && collection?.elements.length === 0 ?
        <span className="border border-1 rounded-sm border-orange-600 bg-orange-100 text-orange-600 inline-flex items-center px-2 py-1 gap-2 mt-2 text-sm">
            <FontAwesome name="exclamation-triangle" />
            <p>The user's home collection will be empty</p>
        </span> :
        null;
    const noCollectionView = minimal || collection == null ?
        <p className="text-sm text-gray-600">{
            collection?.elements.length > 0 ?
                <>Containing <strong>{collection?.elements.length}</strong> elements</> :
                <span className={"text-gray-300"}>Empty collection</span>
        }</p> :
        null;

    return (
        <Card onClick={onClick} className={cn(
            formCardStyles,
            collection ? "text-gray-700" : "text-gray-500 hover:text-gray-700",
            className,
        )}>
            <div className="flex items-center justify-center w-8 h-8">
                <FontAwesome name="folder-open-o" style={{ fontSize: "24px" }} />
            </div>
            {collection ?
                <div className="flex flex-col">
                    <strong>{collection?.titles.at(0).title}</strong>
                    <span className="text-xs">{collection.id}</span>
                    {collectionEmptyView ?? noCollectionView ??
                        <div className="mt-2 flex flex-col gap-2">
                            <p className="text-sm text-gray-500">Collection contains the following items:</p>
                            <CollectionDetailView collection={collection} />
                        </div>}
                </div> :
                <span className="flex flex-col justify-center">Click to select collection</span>}
        </Card>
    )
}

const StatusIcon = ({ valid }: { valid?: boolean }) => valid ?
    <FontAwesome className="absolute top-1 -right-5 text-green-500" name="check-circle" style={{ fontSize: "14px" }} /> :
    <FontAwesome className="absolute top-1 -right-5 text-red-500" name="times-circle" style={{ fontSize: "14px" }} />

const NoResults = ({ children }: React.PropsWithChildren<object>) => <span className="text-sm text-muted-foreground">{children}</span>;

const ClearIcon = (props: { className?: string; enabled: boolean; onClick: () => void; }) => props.enabled ?
    <FontAwesome
        className={cn("absolute top-2 right-2 text-gray-500 hover:text-gray-800 transition-colors cursor-pointer", props.className)}
        name="times-circle"
        style={{ fontSize: "18px" }}
        onClick={props.onClick}
    /> :
    null


function useRawQueryParams(): Map<string, string> {
    const q = window.location.search;
    return new Map(q.slice(1).split("&").map(kv => kv.split("=") as [string, string]));
}

