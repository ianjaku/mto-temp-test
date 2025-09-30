import * as React from "react";
import Dropdown from "./";


export interface IEntriesDropdownProps {
    selectElement: (amount: number) => void;
    entriesPerPage?: number;
}

export interface IEntriesDropdownState {
    selectedElementId: number;
}

class EntriesPerPageDropdown extends React.Component<IEntriesDropdownProps, IEntriesDropdownState> {
    private entries = [];
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props) {
        super(props);
        let selectedElementId = 1;

        this.entries = [
            { id: 1, label: "10" },
            { id: 2, label: "50" },
            { id: 3, label: "100" },
            { id: 4, label: "200" },
        ];
        if(props.entriesPerPage && props.entriesPerPage < 10) {
            this.entries = [{id: 0, label: props.entriesPerPage}, ...this.entries];
            selectedElementId = 0;
        }
        this.state = {
            selectedElementId,
        };
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public selectElement = (id): void => {
        const entry = this.entries.find(e => e.id === id);
        this.setState({ selectedElementId: entry.id });
        this.props.selectElement(parseInt(entry.label, 10));
    }

    public render(): JSX.Element {
        const { selectedElementId } = this.state;
        return (
            <Dropdown
                {...this.props}
                type="Entries"
                elements={this.entries}
                dropUp={true}
                selectedElementId={selectedElementId}
                width={100}
                onSelectElement={this.selectElement}
                className="entriesPerPageDropdown"
            />
        );
    }
}

export default EntriesPerPageDropdown;
