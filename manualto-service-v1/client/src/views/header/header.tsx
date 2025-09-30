import * as React from "react";
import { doElementsOverlap, extractDomainPrefix } from "./util";
import { getReaderDomain, toFullPath } from "../../util";
import { useCanEditAnything, useCanEditCurrentDocument } from "../../helpers/hooks/useAmIEditor";
import { useCurrentUser, useIsPublic } from "../../stores/hooks/user-hooks";
import { BinderStoreGetters } from "../../stores/zustand/binder-store";
import FlashMessages from "@binders/client/lib/react/flashmessages/component";
import { ImpersonationInfo } from "@binders/client/lib/clients/credentialservice/v1/contract";
import ManualToRoutes from "@binders/client/lib/util/readerRoutes";
import SearchInput from "../search/input.jsx";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { UserWidget } from "@binders/ui-kit/lib/elements/userwidget";
import autoBind from "class-autobind";
import classnames from "classnames";
import { getEditorLocation } from "@binders/client/lib/util/domains";
import { getImpersonationInfo } from "@binders/client/lib/util/impersonation";
import { isDev } from "@binders/client/lib/util/environment";
import { navigateToUserSettings } from "../../navigation";
import { useRibbonsTopHeight } from "@binders/ui-kit/lib/compounds/ribbons/hooks";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";
import "./header.styl";
import "@binders/client/assets/flashmessages.styl";

class ReaderHeader extends React.Component<{
    accountId: string;
    canEditAnything: boolean;
    canEditCurrentDocument: boolean;
    currentUser: User | null;
    isPublic: boolean;
    logo: { url: string };
    logoWidth: number;
    ribbonsTopHeight: number | string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router: any;
    userId: string;
}, {
    impersonationInfo?: ImpersonationInfo;
    logoIsOverlapping: boolean;
    logoWidth?: number;
}> {
    private logoElement: HTMLImageElement;

    constructor(props) {
        super(props);
        autoBind(this);
        this.renderControlsWrapper = this.renderControlsWrapper.bind(this);
        this.checkLogoOverlap = this.checkLogoOverlap.bind(this);
        this.state = {
            logoIsOverlapping: false,
        }
    }

    componentDidMount() {
        window.addEventListener("resize", () => this.checkLogoOverlap());
        this.setState({
            impersonationInfo: getImpersonationInfo(),
        })
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.checkLogoOverlap);
    }

    composeEditorUrlParts() {
        const { params } = this.props.router.match;
        const { collectionId: collectionIdFromParams } = params;
        const activeCollectionInfo = BinderStoreGetters.getActiveCollectionInfo();
        const activeCollectionId = activeCollectionInfo?.id;
        const editorLocation = getEditorLocation(getReaderDomain());
        if (!collectionIdFromParams) { // semantic link
            return [
                editorLocation,
                "browse",
                activeCollectionId,
            ];
        }
        const parentPath = params["0"] || "";
        return [
            editorLocation,
            "browse",
            parentPath,
            activeCollectionId || collectionIdFromParams,
        ];
    }

    goToEditor() {
        let url;
        const { canEditAnything, canEditCurrentDocument, router } = this.props;
        const { pathname, search } = router.location;
        if (pathname?.startsWith(ManualToRoutes.SEARCH)) {
            const editorDomain = getEditorLocation(getReaderDomain());
            const urlParts = [editorDomain, "search"];
            const collectionScope = router.match?.params.scopeCollectionId;
            if (collectionScope) {
                urlParts.push(collectionScope);
            }
            const urlSearchParams = new URLSearchParams(search);
            const searchTerm = urlSearchParams.get("q");
            urlSearchParams.delete("q");
            urlParts.push(searchTerm);
            url = `${urlParts.join("/")}?${urlSearchParams.toString()}`;
        } else if (canEditCurrentDocument) {
            const urlParts = this.composeEditorUrlParts();
            url = urlParts.filter(part => !!part).join("/");
        } else if (canEditAnything) {
            url = getEditorLocation(getReaderDomain());
        }
        if (url) {
            const win = window.open(url, "_blank");
            if (win) {
                win.focus();
            }
        }
    }

    goToSettings() {
        navigateToUserSettings(this.props.router.history);
    }

    checkLogoOverlap() {
        if (window.innerWidth < 800) {
            this.setState({ logoIsOverlapping: false });
            return;
        }

        // passing a ref to SearchInput didn't go that well
        const searchInput = document.querySelector(".headerContainer .search");
        if (searchInput == null) {
            return;
        }

        // this code block is ugly but prevents a nasty resize bug on chrome
        const searchStyles = window.getComputedStyle(searchInput, null);
        const searchVisibility = searchStyles.getPropertyValue("visibility");
        if (searchVisibility === "hidden") {
            return;
        }

        const logoIsOverlapping = doElementsOverlap(this.logoElement, searchInput);

        if (logoIsOverlapping) {
            const header = document.querySelector(".headerWrapper");
            const { width } = header.getBoundingClientRect();
            const searchRect = searchInput.getBoundingClientRect();
            const logoRect = this.logoElement.getBoundingClientRect();
            const logoWidth = Math.min(logoRect.width, width - searchRect.x - 30);
            this.setState({ logoIsOverlapping, logoWidth });
        }
    }

    renderDefaultLogo() {
        const domain = getReaderDomain();
        return (
            <a href={toFullPath("/")} className="logo">
                {isDev() ? "debug." : extractDomainPrefix(domain)}
                <strong>manual.to</strong>
            </a>
        );
    }

    renderLogo() {
        const { logo } = this.props;
        const { logoWidth } = this.state;

        return !(logo && logo.url) ?
            this.renderDefaultLogo() :
            (
                <div
                    className="logoWrapper"
                    style={logoWidth ? ({ maxWidth: `${logoWidth}px`, width: `${logoWidth}px` }) : undefined}
                >
                    <a href={toFullPath("/")} className="logo logo--no-padding">
                        <img
                            alt="Logo"
                            src={logo.url}
                            onLoad={this.checkLogoOverlap}
                            ref={ref => { this.logoElement = ref; }}
                        />
                    </a>
                </div>
            );
    }


    renderControlsWrapper() {
        const { impersonationInfo } = this.state;
        const doRenderLogoutButton = !(impersonationInfo?.isImpersonatedSession) || impersonationInfo.isDeviceUserTarget;
        return (
            <div className="controlsWrapper">
                <div className="filters">
                </div>
                <UserWidget
                    goToEditor={this.props.canEditAnything && this.goToEditor.bind(this)}
                    goToSettings={this.goToSettings}
                    accountId={this.props.accountId}
                    renderLogoutButton={doRenderLogoutButton}
                    domain={getReaderDomain()}
                    user={this.props.currentUser}
                    isPublic={this.props.isPublic}
                />
            </div>
        );
    }

    render() {
        const { router, accountId, ribbonsTopHeight, userId } = this.props;
        const { logoIsOverlapping } = this.state;
        const headerClass = classnames(
            "headerContainer",
            { "containHeader": logoIsOverlapping },
        );
        return (
            <div
                className={headerClass}
                style={{
                    marginTop: `${ribbonsTopHeight}px`
                }}
            >
                <header>
                    <FlashMessages />
                    <div className="headerWrapper">
                        <div className="controls">
                            {this.renderLogo()}
                            <SearchInput
                                accountId={accountId}
                                router={router}
                                userId={userId}
                            />
                            {this.renderControlsWrapper()}
                        </div>
                        <div className="searchWrapper">
                            <SearchInput
                                accountId={accountId}
                                router={router}
                                userId={userId}
                            />
                        </div>
                    </div>
                </header>
            </div>
        );
    }
}

export default withHooks(ReaderHeader, () => ({
    ribbonsTopHeight: useRibbonsTopHeight(),
    canEditAnything: useCanEditAnything(),
    canEditCurrentDocument: useCanEditCurrentDocument(),
    currentUser: useCurrentUser(),
    isPublic: useIsPublic(),
}));
