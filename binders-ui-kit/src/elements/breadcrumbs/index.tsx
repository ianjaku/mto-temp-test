import * as React from "react";
import BreadcrumbItem from "./item";
import CaretRight from "../icons/CaretRight";
import { Link } from "react-router-dom";
import debounce from "lodash.debounce";
import "./breadcrumbs.styl";

export interface IBreadcrumbItem {
    name: string;
    link?: string;
    readonly?: boolean;
    strikeThrough?: boolean;
    tooltip?: string;
    renderAsLast?: boolean;
}

export interface IBreadcrumbsProps {
    items: IBreadcrumbItem[];
    onClick?: (object) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    itemContextMenu?: ((data) => React.ReactElement<any>) | JSX.Element;
    keySuffix?: string;
}

export interface IBreadcrumbState {
    breadcrumbsEl?: HTMLElement;
    itemsWrapperEl?: HTMLElement;
    hiddenElementsCount: number;
    truncatedElementsCount: number;
    lastClipOperation?: ClipOperation;
}

enum ClipOperation {
    Truncate,
    Hide,
}

class Breadcrumbs extends React.Component<IBreadcrumbsProps, IBreadcrumbState> {
    private onResize: () => void;

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props) {
        super(props);
        this.onResize = debounce(this.reMaybeClipBreadcrumbs.bind(this), 500);
        window.addEventListener("resize", this.onResize);
        this.maybeClipBreadcrumbs = this.maybeClipBreadcrumbs.bind(this);
        this.setItemsWrapperRef = this.setItemsWrapperRef.bind(this);
        this.setBreadcrumbsElRef = this.setBreadcrumbsElRef.bind(this);
        this.state = {
            hiddenElementsCount: 0,
            truncatedElementsCount: 0,
        };
    }

    public componentWillUnmount(): void {
        window.removeEventListener("resize", this.onResize);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public componentDidUpdate(_prevProps, prevState): void {
        const { itemsWrapper: prevItemsWrapper, breadcrumbsEl: prevBreadcrumbsEl } = prevState;
        const { itemsWrapperEl, breadcrumbsEl } = this.state;
        const breadcrumbsElChanged = breadcrumbsEl !== prevBreadcrumbsEl;
        const itemsWrapperElChanged = itemsWrapperEl !== prevItemsWrapper;
        if (breadcrumbsElChanged || itemsWrapperElChanged) {
            this.maybeClipBreadcrumbs();
        }
    }

    private maybeClipBreadcrumbs() {
        const { hiddenElementsCount, truncatedElementsCount, itemsWrapperEl, breadcrumbsEl, lastClipOperation } = this.state;
        let stateUpdate;
        let newLastClipOperation;
        if (lastClipOperation === undefined || (lastClipOperation === ClipOperation.Hide)) {
            stateUpdate = {
                truncatedElementsCount: truncatedElementsCount + 1,
            }
            newLastClipOperation = ClipOperation.Truncate;
        } else {
            stateUpdate = {
                hiddenElementsCount: hiddenElementsCount + 1,
            }
            newLastClipOperation = ClipOperation.Hide;
        }
        if (itemsWrapperEl.clientWidth > breadcrumbsEl.clientWidth) {
            this.setState({
                lastClipOperation: newLastClipOperation,
                ...stateUpdate,
            });
        }
    }

    private reMaybeClipBreadcrumbs() {
        this.setState({
            hiddenElementsCount: 0,
            truncatedElementsCount: 0,
        }, () => this.maybeClipBreadcrumbs());
    }

    private setItemsWrapperRef(ref) {
        const { itemsWrapperEl } = this.state;
        if (itemsWrapperEl === undefined) {
            this.setState({ itemsWrapperEl: ref });
        }
    }

    private setBreadcrumbsElRef(ref) {
        const { breadcrumbsEl } = this.state;
        if (breadcrumbsEl === undefined) {
            this.setState({ breadcrumbsEl: ref });
        }
    }

    public render(): JSX.Element {
        return (
            <div className="breadcrumbs" ref={this.setBreadcrumbsElRef}>
                <div className="breadcrumbs-itemswrapper" ref={this.setItemsWrapperRef}>
                    {this.renderItems()}
                </div>
            </div>
        );
    }

    private renderItems() {
        const { items, onClick, itemContextMenu, keySuffix } = this.props;

        const { hiddenElementsCount, truncatedElementsCount } = this.state;

        const generalMaxWidth = this.calculateMaxBreadcrumbWidth();
        const hasItemContextMenu = !!itemContextMenu;

        const isFirstLinkEmpty = (items.at(0)?.name?.length ?? 0) === 0;

        return items
            .slice(hiddenElementsCount + (isFirstLinkEmpty ? 1 : 0))
            .reduce((acc, { name, link, readonly, strikeThrough, tooltip, renderAsLast }, index, arr) => {
                const isLast = renderAsLast !== undefined ? renderAsLast : (arr.length === index + 1);
                const previousLink = index > 0 && items[index - 1].link;
                const isOffset = hiddenElementsCount > 0;
                const isEllipsis = isOffset && index === 0;

                const maxWidth = index < truncatedElementsCount ? generalMaxWidth : undefined;

                const breadCrumbItem = (
                    <BreadcrumbItem
                        key={`item-${index}${keySuffix}`}
                        onClick={onClick}
                        name={isEllipsis ? "..." : name}
                        link={link}
                        isLast={isLast}
                        isReadonly={readonly}
                        isStrikeThrough={strikeThrough}
                        tooltip={tooltip}
                        maxWidth={maxWidth}
                        itemContextMenu={itemContextMenu}
                        hasItemContextMenu={hasItemContextMenu}
                    />
                );

                const arrow = (previousLink || link ?
                    (
                        <Link
                            className="breadcrumbs-arrow"
                            key={`carrret-${index}${keySuffix}`}
                            to={previousLink || link}
                            tabIndex={-1}
                        >
                            {{ ...CaretRight("") }}
                        </Link>
                    ) :
                    (
                        <div className="breadcrumbs-arrow">
                            {{ ...CaretRight("", {}, `carrret-${index}${keySuffix}`) }}
                        </div>
                    )
                );

                return [
                    ...acc,
                    index > 0 ? arrow : null,
                    breadCrumbItem,
                ];
            }, []);
    }

    private calculateMaxBreadcrumbWidth(): number {
        const { items } = this.props;
        const { breadcrumbsEl } = this.state;
        const { hiddenElementsCount } = this.state;
        const visibleItemsCount = items.length - hiddenElementsCount;
        return breadcrumbsEl && (breadcrumbsEl.clientWidth / visibleItemsCount) || undefined;
    }
}

export default Breadcrumbs;
