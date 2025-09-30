import * as React from "react";
import CaretLeft from "../icons/CaretLeft";
import CaretRight from "../icons/CaretRight";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { isMobileView } from "../../helpers/rwd";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./pagination.styl";

export interface IPaginationProps extends React.HTMLProps<HTMLDivElement> {
    max: number;
    onPageChange?: (page: number) => void;
    displayPages?: number;
}

export interface IPaginationState {
    current: number;
    isMobile: boolean;
}

class Pagination extends React.Component<IPaginationProps, IPaginationState> {
    public static defaultProps: Partial<IPaginationProps> = {
        displayPages: 5,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        onPageChange: page => {
            return;
        },
    };

    private t: TFunction;

    constructor(props) {
        super(props);
        this.t = props.t;
        this.state = {
            current: 1,
            isMobile: isMobileView(),
        };
    }

    public changePage = (from, to) => {
        this.props.onPageChange(to);
        this.setState({ current: to });
    }

    public calculateStart() {
        const { current } = this.state;
        const { max } = this.props;
        const displayPages = Math.floor(this.props.displayPages / 2);
        const start =
            current + displayPages > max ? max - displayPages * 2 : current - displayPages;
        if (start < 1) {
            return 1;
        }
        return start;
    }

    public calculateEnd() {
        const { current } = this.state;
        const { max } = this.props;
        const min = this.calculateMin();
        const displayPages = Math.floor(this.props.displayPages / 2);
        const end = current - displayPages < min ? min + displayPages * 2 : current + displayPages;
        if (end > max) {
            return max;
        }
        return end;
    }

    public calculateMin() {
        const { max } = this.props;
        return max > 1 ? 1 : max;
    }

    public generatePages() {
        const { max } = this.props;
        const pages = [];

        // determine borders
        const start = this.calculateStart();
        const end = this.calculateEnd();

        for (let i = start; i <= end && i >= this.calculateMin() && i <= max; i++) {
            pages.push(i);
        }
        return pages;
    }

    public renderPages(pages) {
        const current = this.state.current;
        const pagesToRender = this.state.isMobile ?
            pages.filter(page => page === current || page === current - 1 || page === current + 1) :
            pages;
        return pagesToRender.map(page => {
            return (
                <li
                    key={page}
                    className={cx(current === page ? "active" : undefined)}
                    onClick={this.changePage.bind(this, this.state.current, page)}
                >
                    {page}
                </li>
            );
        });
    }

    public renderLast(enabled) {
        return (
            <li
                onClick={
                    enabled ?
                        this.changePage.bind(this, this.state.current, this.props.max) :
                        undefined
                }
                className={cx(!enabled ? "disabled" : undefined)}
            >
                {!this.state.isMobile && this.t(TranslationKeys.General_Last)}
                {CaretRight("pagination-icon")}
                {CaretRight("pagination-icon")}
            </li>
        );
    }
    public renderNext(enabled) {
        return (
            <li
                onClick={
                    enabled ?
                        this.changePage.bind(this, this.state.current, this.state.current + 1) :
                        undefined
                }
                className={cx(!enabled ? "disabled" : undefined)}
            >
                {!this.state.isMobile && this.t(TranslationKeys.General_Next)}
                {CaretRight("pagination-icon")}
            </li>
        );
    }
    public renderFirst(enabled) {
        return (
            <li
                onClick={enabled ? this.changePage.bind(this, this.state.current, 1) : undefined}
                className={cx(!enabled ? "disabled" : undefined)}
            >
                {CaretLeft("pagination-icon")}
                {CaretLeft("pagination-icon")}
                {!this.state.isMobile && this.t(TranslationKeys.General_First)}
            </li>
        );
    }
    public renderPrevious(enabled) {
        return (
            <li
                onClick={
                    enabled ?
                        this.changePage.bind(this, this.state.current, this.state.current - 1) :
                        undefined
                }
                className={cx(!enabled ? "disabled" : undefined)}
            >
                {CaretLeft("pagination-icon")}
                {!this.state.isMobile && this.t(TranslationKeys.General_Previous)}
            </li>
        );
    }

    public render() {
        const { max } = this.props;
        const { current } = this.state;
        const pageRange = this.generatePages();
        const pages = this.renderPages(pageRange);

        const first = this.renderFirst(current > 2);
        const previous = this.renderPrevious(current > 1);
        const next = this.renderNext(current < max);
        const last = this.renderLast(current < max - 1);

        return (
            <ul className="pagination">
                <span>{this.t(TranslationKeys.General_Page)}</span>
                {first}
                {previous}
                {pages}
                {next}
                {last}
            </ul>
        );
    }
}

export default withTranslation()(Pagination);
