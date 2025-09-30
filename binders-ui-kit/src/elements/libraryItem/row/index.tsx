import * as React from "react";
import Thumbnail, { FitBehaviour } from "../../thumbnail";
import Tooltip, { TooltipPosition, hideTooltip, showTooltip } from "../../tooltip/Tooltip";
import ClientThumbnail from "@binders/client/lib/clients/repositoryservice/v3/Thumbnail";
import { IChecklistProgress } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import Icon from "../../icons";
import MoreVert from "../../icons/MoreVert";
import ProgressBar from "../../progress-bar";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import circularProgress from "../../circularprogress";
import { closestByClassName } from "../../../helpers/helpers";
import { contextMenuPopoverClass } from "../../contextmenu";
import cx from "classnames";
import { isMobileView } from "../../../helpers/rwd";
import { menuItemOptionClass } from "../../contextmenu/MenuItem";
import vars from "../../../variables";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./libraryrow.styl";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const UserIcon = require("../../../../public/icons/user-avatar.svg");

export enum ItemType {
    DOCUMENT = 0,
    COLLECTION = 1,
}

export interface IBasicUserInfo {
    id: string;
    login: string;
    displayName: string;
}

export interface ILibraryRowProps {
    title?: string;
    htmlTitle?: { __html: string };
    thumbnail: ClientThumbnail;
    type?: ItemType;
    libraryRowActions?: ILibraryRowAction[];
    onClick?: () => "pending" | void;
    width?: string;
    className?: string;
    views?: number | JSX.Element;
    lockedBy?: IBasicUserInfo;
    isHidden?: boolean;
    contextMenu?: JSX.Element;
    isPending?: boolean;
    additionalInfo?: string;
    additionalInfoMobile?: string;
    isPublicInfo?: { isPublic?: boolean, isAncestorPublic?: boolean }
    isPublicIconDisabled?: boolean;
    checklistProgress?: IChecklistProgress;
    usePlaceholderThumbnail?: boolean;
    wantsAttention?: boolean;
    shareButton?: React.ReactNode;
}

export interface ILibraryRowState {
    isActive: boolean;
    checklistProgressPercentage?: number;
    isPendingClick?: boolean;
}

export interface ILibraryRowAction {
    title: string;
    iconName: string;
    onClick: () => void;
    className?: string;
}

const iconsStyle = {
    fontSize: "20px",
};

class LibraryRow extends React.Component<ILibraryRowProps, ILibraryRowState> {

    private lockedByTooltip: Tooltip;
    private publicIconTooltip: Tooltip;
    private t;
    private rowContent;
    private rowTitle;

    constructor(props) {
        super(props);
        this.t = props.t;
        this.setActive = this.setActive.bind(this);
        this.onClick = this.onClick.bind(this);
        this.getPublicIcon = this.getPublicIcon.bind(this);
        // this.renderContextMenu = this.renderContextMenu.bind(this);
        this.renderThumbnail = this.renderThumbnail.bind(this);
        this.renderViews = this.renderViews.bind(this);
        this.hideTooltip = this.hideTooltip.bind(this);
        this.showTooltip = this.showTooltip.bind(this);
        this.showPublicTooltip = this.showPublicTooltip.bind(this);
        this.hidePublicTooltip = this.hidePublicTooltip.bind(this);
        this.renderAdditionalInfo = this.renderAdditionalInfo.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.state = {
            isActive: false,
        };
    }

    public componentDidMount() {
        const { checklistProgress, wantsAttention } = this.props;
        if (checklistProgress) {
            this.calcChecklistProgressPercentage(checklistProgress);
        }
        if (wantsAttention && this.rowContent != null) {
            setTimeout(() => this.rowContent && this.rowContent.scrollIntoView({
                behavior: "smooth",
                block: "start",
            }), 1000);
            window.history.pushState(null, "Manual.to Editor", window.location.origin + window.location.pathname);
        }
    }

    public componentDidUpdate(prevProps) {
        const { checklistProgress } = this.props;
        const { checklistProgress: prevChecklistProgress } = prevProps;
        if (checklistProgress !== prevChecklistProgress) {
            this.calcChecklistProgressPercentage(checklistProgress);
        }
    }

    private calcChecklistProgressPercentage(checklistProgress: IChecklistProgress) {
        const { performed, total } = checklistProgress;
        if (performed === undefined || total === undefined) {
            return;
        }
        this.setState({
            checklistProgressPercentage: performed / total,
        })
    }

    public hideTooltip(e: React.MouseEvent<HTMLElement>): void {
        hideTooltip(e, this.lockedByTooltip);
    }

    public showTooltip(position: TooltipPosition): (e: React.MouseEvent<HTMLElement>) => void {
        return e => {
            showTooltip(e, this.lockedByTooltip, position);
        };
    }

    public renderPending() {
        return (
            <div className={cx("library-row", "library-row--is-pending")}>
                <div className="library-row-image">
                    {this.renderThumbnail()}
                </div>
                <div className="library-row-content">
                    <div className="library-row-content-right">
                        {}
                    </div>
                </div>
            </div>
        );
    }

    public renderChecklistProgress() {
        const { checklistProgressPercentage } = this.state;
        const { checklistProgress } = this.props;
        return checklistProgressPercentage === undefined ?
            (
                <div className="progress-bar" />
            ) :
            (
                <ProgressBar percentage={checklistProgressPercentage} lastUpdated={checklistProgress.lastUpdated} />
            );
    }

    renderShareButton() {
        if (this.props.isPending || !this.props.shareButton) return null;
        return this.props.shareButton;
    }

    public render() {
        const { width, className, lockedBy, isPending, wantsAttention } = this.props;
        const { isActive } = this.state;
        const style = width ? { width } : {};

        return (
            <div>
                <div
                    key="row-default"
                    className={
                        cx(
                            "library-row",
                            { "is-draggingAttention": wantsAttention },
                            { "is-active": isActive },
                            { "is-locked": !!lockedBy },
                            { "library-row--is-pending": isPending },
                            className,
                        )
                    }
                    style={style}
                    onClick={this.onClick}
                >
                    <div className="library-row-image">
                        {!isPending && this.renderThumbnail()}
                    </div>
                    <div className="library-row-content" ref={r => this.rowContent = r}>
                        <div className="library-row-content-title" ref={r => this.rowTitle = r}>
                            {this.renderChecklistProgress()}
                            {this.renderTitle()}
                            {this.renderAdditionalInfo()}
                        </div>
                        {this.renderLockedBy()}
                        <div className="library-row-content-right">
                            {this.renderViews()}
                            {this.renderVisibilityIndicator()}
                            {this.renderShareButton()}
                            {this.renderContextMenu()}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    private showPublicTooltip(e) {
        showTooltip(e, this.publicIconTooltip, TooltipPosition.TOP);
    }

    private hidePublicTooltip(e) {
        hideTooltip(e, this.publicIconTooltip);
    }

    private maybeRenderPendingClickLoader() {
        if (!this.state.isPendingClick) {
            return null;
        }
        return circularProgress("library-row-content-clickLoader");
    }

    private renderTitle() {
        const { title, htmlTitle, isPublicInfo, isPublicIconDisabled } = this.props;
        const { checklistProgressPercentage } = this.state;
        const publicIcon = isPublicIconDisabled ? { icon: "", message: "" } : this.getPublicIcon(isPublicInfo);
        const labelClassName = "library-row-content-title-label";
        const isCheckListProgressVisible = (checklistProgressPercentage === undefined) ? 0 : 1;
        const areRefsReady = this.rowContent && this.rowTitle;
        const additionalInfoHeight = isMobileView() ? 0 : vars.additionalInfoHeightDesktop;
        const checklistProgressHeight = isMobileView() ? vars.checklistProgressHeightMobile : vars.checklistProgressHeightDesktop;
        const isTitleTooHigh = areRefsReady ?
            (this.rowContent.offsetHeight - (isCheckListProgressVisible * checklistProgressHeight) - additionalInfoHeight < this.rowTitle.offsetHeight) :
            false;

        let marginTop;
        if (isMobileView()) {
            marginTop = isCheckListProgressVisible ? `${checklistProgressHeight}px` : "0";
        } else {
            marginTop = isCheckListProgressVisible ? `${checklistProgressHeight}px` : "5px";
        }

        const styleForTooHighTitle = {
            marginTop,
            alignItems: "flex-start",
        };

        let titleElement;
        if (title) {
            titleElement = <label className={labelClassName}>{title}</label>;
        } else if (htmlTitle) {
            titleElement = <label className={labelClassName} dangerouslySetInnerHTML={htmlTitle} />;
        } else {
            titleElement = <div />;
        }
        const hasCollectionIcon = this.props.type === ItemType.COLLECTION;
        return (
            <div className="library-row-content-title-wrapper" style={isTitleTooHigh ? styleForTooHighTitle : {}}>
                <Tooltip ref={ref => { this.publicIconTooltip = ref; }} message={publicIcon.message} />
                {hasCollectionIcon && (
                    <Icon
                        name="folder"
                        className={cx(
                            "library-row-content-icon library-row-content-icon-baseline",
                        )}
                    />
                )}
                {titleElement}
                {
                    isPublicInfo && publicIcon.icon
                }
                {this.maybeRenderPendingClickLoader()}
            </div>
        );
    }

    private renderAdditionalInfo() {
        const { additionalInfo, additionalInfoMobile, isPending } = this.props;
        if (isPending) {
            return null;
        }
        return (
            <>
                {additionalInfo && <div className="library-row-content-title-info">{additionalInfo}</div>}
                {additionalInfoMobile && <div className="library-row-content-title-info library-row-content-title-info--mobile">{additionalInfoMobile}</div>}
            </>
        );
    }

    private renderVisibilityIndicator() {
        const { isHidden } = this.props;
        return !!isHidden && (
            <Icon name="visibility_off" className={cx("material-icons", "library-row-content-title-icon")} />
        );
    }

    private renderLockedBy() {
        const { lockedBy } = this.props;
        const displayValue = lockedBy && (
            lockedBy.displayName || lockedBy.login || lockedBy.id
        );
        return !!lockedBy && (
            <div
                className="locked-by"
                onMouseEnter={this.showTooltip(TooltipPosition.BOTTOM)}
                onMouseLeave={this.hideTooltip}
            >
                <div className="locked-by-usericon">
                    <img src={UserIcon} />
                </div>
                <div className="locked-by-dots">
                    <span className="locked-by-dots-dot" />
                    <span className="locked-by-dots-dot" />
                    <span className="locked-by-dots-dot" />
                </div>
                <Tooltip ref={ref => { this.lockedByTooltip = ref; }} message={this.t(TranslationKeys.Edit_ItemEditedBy, { displayValue })} />
            </div>
        );
    }

    private renderViews() {
        const { views } = this.props;
        return !views ?
            <div className="statistics" /> :
            (
                <div className="statistics">
                    <h4>{this.t(TranslationKeys.Analytics_View, { count: 2 })}</h4>
                    <span className="amount">
                        {views}
                    </span>
                </div>
            );
    }

    private renderContextMenu() {
        const { isPending, contextMenu } = this.props;
        return (isPending) ?
            MoreVert({ marginRight: "12px", color: vars.middleGreyColor }) :
            contextMenu;
    }

    private renderThumbnail() {
        const { thumbnail } = this.props;
        const thumbnailSrc = thumbnail.buildRenderUrl ?
            thumbnail.buildRenderUrl() :
            thumbnail.medium;

        return (
            <Thumbnail
                usePlaceholder={this.props.usePlaceholderThumbnail}
                fitBehaviour={thumbnail.fitBehaviour === "crop" ? FitBehaviour.CROP : FitBehaviour.FIT}
                bgColor={thumbnail.bgColor}
                src={thumbnailSrc}
                width={86}
                stretchImage={false}
                rotation={thumbnail.rotation ? parseInt(thumbnail.rotation, 10) : 0}
            />
        );
    }

    private getPublicIcon(publicInfo) {
        const { type } = this.props;

        if (!publicInfo) {
            return {};
        }
        const { isPublic, hasPublicAncestors } = publicInfo;
        if (!isPublic && !hasPublicAncestors) {
            return {};
        }

        return {
            icon: (
                <Icon
                    onMouseEnter={this.showPublicTooltip}
                    onMouseLeave={this.hidePublicTooltip}
                    themeColor={hasPublicAncestors ? "disabled" : "primary"}
                    style={iconsStyle}
                    className={cx("material-icons", "library-row-content-title-icon")}
                    name="public"
                />
            ),
            message: hasPublicAncestors ?
                this.t(TranslationKeys.DocManagement_ItemInPublic, { type: ItemType[type].toLowerCase() }) :
                this.t(TranslationKeys.DocManagement_ItemPublic, { type: ItemType[type].toLowerCase() }),
        };
    }

    private handleClick(attempt = 0) {
        if (attempt > 100) {
            this.setState({ isPendingClick: false });
            return;
        }
        const { onClick } = this.props;
        const clickResult = onClick();
        if (clickResult === "pending") {
            if (attempt === 0) {
                this.setState({ isPendingClick: true });
            }
            setTimeout(() => this.handleClick(attempt + 1), 200);
            return;
        }
        this.setState({ isPendingClick: false });
    }

    private onClick({ target }) {
        // IE vs the other browsers (the saga continues)
        //
        // Most browsers fill in the className field
        // IE does not, but does give us the target.type
        const { lockedBy, onClick } = this.props;

        const expandMenuClicked = (
            target.type === "button" ||
            target.className.includes("contextMenu-icon") ||
            target.className.includes(menuItemOptionClass) ||
            closestByClassName(target, "modal")
        );
        if (target.parentElement && target.parentElement.className.includes(contextMenuPopoverClass)) {
            return;
        }
        if (!expandMenuClicked && onClick && !lockedBy && !this.state.isPendingClick) {
            this.handleClick();
        }
    }

    private setActive(isActive) {
        this.setState({
            isActive,
        });
    }
}

export default withTranslation()(LibraryRow);
