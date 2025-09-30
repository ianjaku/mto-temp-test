import * as React from "react";
import Chip from "@material-ui/core/Chip";
import { ChipComponentProps } from "./contract";
import CircularProgress from "../circularprogress";
import ClearIcon from "@material-ui/icons/Clear";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import Tooltip from "@material-ui/core/Tooltip";
import autobind from "class-autobind";
import colors from "../../variables";
import cx from "classnames";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./autocomplete.styl";

export interface IAutocompleteItem {
    label: string;
    rawLabel: string;
    id: string;
    value: string;
    isNew?: boolean;
}

enum LoadingState {
    Loading = "Loading",
    Initial = "Initial",
    Complete = "Complete",
}

export interface IAutocompleteProps {
    data: IAutocompleteItem[];
    onUpdateSearchTerm?: (term: string) => void;
    // eslint-disable-next-line @typescript-eslint/ban-types
    onAddNewClick: (item: object) => void;
    // eslint-disable-next-line @typescript-eslint/ban-types
    onDeleteChipClick: (item: object) => void;
    selectedItems: IAutocompleteItem[];
    totalResults?: number;
    maxAllowedSelectedItems?: number;
    ChipComponent?: React.FC<ChipComponentProps> | React.ComponentClass<ChipComponentProps>;
    wrapChips?: boolean;
    saveOnBlur?: boolean;
    placeholder?: string;
    onInputRef?: (ref: HTMLTextAreaElement) => void;
    isLoading?: boolean;
    renderLeadingSlot?: () => React.ReactNode;
    renderTrailingSlot?: () => React.ReactNode;
    allowItemCreation?: boolean;
    noMatchesOverride?: string;
    hideIcon?: boolean;
}

export interface IAutocompleteState {
    searchTerm: string;
    loadingState?: LoadingState;
}

class Autocomplete extends React.Component<IAutocompleteProps, IAutocompleteState> {

    private autocomplete = null;
    private t;

    constructor(props) {
        super(props);
        this.t = props.t;
        autobind(this);
        this.state = {
            searchTerm: "",
            loadingState: LoadingState.Initial,
        };
    }

    public componentDidUpdate(prevProps: IAutocompleteProps) {
        const { isLoading: wasLoading } = prevProps;
        if (!wasLoading && this.props.isLoading) {
            this.setState({
                loadingState: LoadingState.Loading,
            });
        }
        if (wasLoading && !this.props.isLoading) {
            this.setState({
                loadingState: LoadingState.Complete,
            });
        }
    }

    private maybeAddMoreArea() {
        const { selectedItems, maxAllowedSelectedItems, placeholder, onInputRef } = this.props;

        if (selectedItems.length >= maxAllowedSelectedItems) {
            return null;
        }

        const isClean = selectedItems.length === 0;
        const plHolder = isClean ?
            (placeholder || this.t(TK.User_AddUserOrUsergroup)) :
            this.t(TK.General_AddMore);
        return (
            <textarea
                rows={1}
                placeholder={plHolder}
                onChange={this.onChange}
                onKeyPress={this.onRequestAdd}
                onBlur={this.onBlur}
                className="autocomplete-textarea"
                value={this.state.searchTerm}
                ref={onInputRef}
            />
        );
    }

    public render() {
        const { selectedItems, wrapChips, renderLeadingSlot, renderTrailingSlot, hideIcon } = this.props;
        const isClean = selectedItems.length === 0;
        const className = cx("autocomplete", {
            "autocomplete--is-dirty": !isClean,
            "autocomplete--hideIcon": hideIcon || !!renderLeadingSlot,
            "autocomplete--loadingComplete": this.state.loadingState === LoadingState.Complete,
        });
        return (
            <div className="autocomplete-wrapper">
                <div
                    ref={autocomplete => { this.autocomplete = autocomplete; }}
                    className={className}
                >
                    {renderLeadingSlot && renderLeadingSlot()}
                    <div className="autocomplete-pane" style={wrapChips ? { flexFlow: "wrap" } : {}}>
                        <div className="autocomplete-pane-chips">
                            {this.renderChips()}
                            {this.maybeAddMoreArea()}
                        </div>
                    </div>
                    {renderTrailingSlot && renderTrailingSlot()}
                    {this.props.isLoading && (
                        <div className="autocomplete-alignEnd">
                            {CircularProgress("", {}, undefined, colors.disabledColor)}
                        </div>
                    )}
                </div>
                {this.renderPrompts()}
            </div>
        );
    }

    private onChange({ target: { value } }) {
        this.setState({
            searchTerm: value,
            loadingState: LoadingState.Initial,
        });
        if (this.props.onUpdateSearchTerm) {
            this.props.onUpdateSearchTerm(value);
        }
    }

    /* RENDERS */

    private renderChip(label: string, value: string, isNew: boolean, isUser: boolean) {
        const { ChipComponent, maxAllowedSelectedItems } = this.props;
        const usesCustomChip = !!ChipComponent;
        const ChipToRender = this.props.ChipComponent || Chip;
        return (
            <div className={cx("autocomplete-chipWrapper", { "autocomplete-chipWrapper--singleChip": maxAllowedSelectedItems === 1 })}>
                <ChipToRender
                    classes={{
                        root: `autocomplete-chip ${isUser ? "autocomplete-chip--user" : "autocomplete-chip--group"}`,
                    }}
                    className={"autocomplete-chip"}
                    deleteIcon={<ClearIcon style={{ fill: colors.disabledColor, marginTop: "1px", width: "14px" }} />}
                    onDelete={this.onDeleteChip(value, label, isNew)}
                    label={label}
                    value={value}
                    {...(usesCustomChip ? { isNew } : {})}
                />
            </div>
        );
    }

    private renderChips() {
        const { selectedItems } = this.props;

        return selectedItems.map(({ id, label, value, isNew = false }) => {
            const tooltipProps = isNew ?
                { title: this.t(TK.User_NoUserOrUserGroup) } :
                { title: "", open: false }
            return (
                <Tooltip key={value} {...tooltipProps}>
                    <>
                        {this.renderChip(label, value, isNew, id.startsWith("uid-"))}
                    </>
                </Tooltip>
            );
        });
    }

    private renderPrompts() {
        const { totalResults, noMatchesOverride } = this.props;
        const items = this.getFilteredData();
        if (this.state.loadingState === LoadingState.Complete && items.length === 0) {
            return (
                <ul
                    className={cx("autocomplete-prompt", "autocomplete-prompt--infoMsg")}
                    style={{
                        width: this.autocomplete ? this.autocomplete.clientWidth : "auto",
                    }}
                >
                    <li className="autocomplete-prompt-item">
                        {noMatchesOverride ?? this.t(TK.General_NoMatches)}
                    </li>
                </ul>
            )
        }
        const onAutocompleteSelection = (e: React.MouseEvent, { label, rawLabel, value, id }: IAutocompleteItem) => {
            e.stopPropagation();
            this.addItem({ label, rawLabel, value, id, isNew: false });
        }
        const hasMoreResults = totalResults ? totalResults >= 10 && items.length < totalResults : false;
        return items.length === 0 ?
            <div /> :
            (
                <ul className="autocomplete-prompt">
                    {items.map(item => (
                        <li
                            key={item.value}
                            className={"autocomplete-prompt-item"}
                            onClick={e => onAutocompleteSelection(e, item)}
                        >
                            {item.label}
                        </li>
                    ))}
                    {hasMoreResults && (
                        <li key="more-results" className={"autocomplete-prompt-item--more-results"}>
                            {this.t(TK.General_MoreResultsRefineQuery, { count: totalResults - items.length })}
                        </li>
                    )}
                </ul>
            );
    }

    /* HELPER METHODS */
    private onRequestAdd(e) {
        if (e.key.toUpperCase() === "ENTER") {
            e.preventDefault();
            this.onEnter(e);
        }
    }

    private addItem({ label, rawLabel, value, id, isNew = false }) {
        this.props.onAddNewClick({ label, rawLabel, value, id, isNew });
        this.setState({
            searchTerm: "",
            loadingState: LoadingState.Initial,
        });
        setTimeout(() => this.autocomplete.scrollTop = this.autocomplete.scrollHeight, 100);
    }

    /* EVENT HANDLERS */

    private onDeleteChip(value, label, isNew) {
        return () => this.props.onDeleteChipClick({ isNew, label, value });
    }

    private onEnter(e) {
        // todo scroll to bottom
        const searchTerm = e.target.value;
        if (searchTerm) {
            const proposals = this.getFilteredData();
            if (proposals.length) {
                this.addItem(proposals[0]);
                return;
            }
            if (this.props.allowItemCreation) {
                this.addItem(this.getEmptyPossibleAnswer(searchTerm));
            }
        }
    }

    private onBlur(e) {
        if (this.props.saveOnBlur) {
            const filteredItems = this.getFilteredData();
            if (!filteredItems.length) { // only save on blur if there is no match
                this.onEnter(e);
            }
        }
    }

    private getEmptyPossibleAnswer(searchTerm: string): IAutocompleteItem {
        return {
            id: "",
            isNew: true,
            label: searchTerm,
            rawLabel: searchTerm,
            value: searchTerm,
        };
    }

    private getFilteredData(): IAutocompleteItem[] {
        const { searchTerm } = this.state;
        if (searchTerm.length < 3) {
            return [];
        }
        const { data, selectedItems } = this.props;
        return data
            .filter(({ value }) => ( // filter out items that are already selected
                !selectedItems.some(({ value: selectedValue }) => selectedValue === value)
            ))
            .filter(item => ( // filter out items that don't match search term
                item.label.toLowerCase().indexOf(searchTerm.toLowerCase()) >= 0
            ));
    }
}

export default withTranslation()(Autocomplete);
