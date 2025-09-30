import * as React from "react";
import debounce from "lodash.debounce";
import { isIOSSafari } from "@binders/client/lib/react/helpers/browserHelper";
import { ribbonsContext } from "../../compounds/ribbons/RibbonsView";
import "./rightPane.styl";

export interface IPaneProps {
    onClick?: (index: number) => void;
    onClose?: (index: number) => void;
    /**
     * The index of the opened pane item.
     * When set, will no longer handle the opening and closing of pane items internally.
     * Set to -1 to close the pane.
     */
    index?: number;
    ribbonsTopHeight: number;
}
export interface IPaneState {
    openedIndex: number;
}

class Pane extends React.Component<IPaneProps, IPaneState> {
    static contextType = ribbonsContext;

    constructor(props: IPaneProps) {
        super(props);
        this.state = {
            openedIndex: -1,
        };
        this.onItemClick = this.onItemClick.bind(this);
        if (isIOSSafari()) {
            this.onItemClick = debounce(this.onItemClick.bind(this), 100);
        }
        this.onClose = this.onClose.bind(this);
    }

    private getOpenedIndex(): number {
        if (this.props.index == null) {
            return this.state.openedIndex;
        }
        return this.props.index;
    }

    public render(): JSX.Element {
        const openedIndex = this.getOpenedIndex();

        return (
            <div
                className="rightPane"
                style={{ marginTop: `${this.context.ribbonsTopHeight}px` }}
            >
                {React.Children.map(this.props.children, (child: React.ReactElement, index) => {
                    if (!child) {
                        return null;
                    }
                    const onClick = child.key === "add-languages-contextmenu" ?
                        () => {
                            child.props.onClick(); // Propagate click to component
                            this.onItemClick(index);
                        } :
                        this.onItemClick;
                    return React.cloneElement(
                        child,
                        {
                            index,
                            isOpened: index === openedIndex,
                            onClick,
                            onClose: () => this.onClose(index),
                        },
                    );
                })}
            </div>
        );
    }

    private onClose(index: number) {
        const { onClose } = this.props;
        this.setState({ openedIndex: -1 });
        if (typeof onClose === "function") {
            onClose(index);
        }
    }

    public onItemClick(index: number): void {
        const { onClick } = this.props;
        const { openedIndex } = this.state;
        if (typeof onClick === "function") {
            onClick(index);
        }
        this.setState({ openedIndex: index === openedIndex ? -1 : index });
    }
}

export default Pane;

