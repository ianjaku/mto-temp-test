import * as React from "react";
import Accordion from "./Accordion";

export interface IAccordionGroupProps {
    children?: React.ReactElement<Accordion> | Array<React.ReactElement<Accordion>>;
    isMultiOpen?: boolean;
    initialOpenedIndex?: number;
    onChangeOpenIndexes?: (openIndexes) => void;
}

export interface IAccordionGroupState {
    openedIndexes: number[];
}

class AccordionGroup extends React.Component<IAccordionGroupProps, IAccordionGroupState> {

    private static defaultProps = {
        isMultiOpen: false,
    };

    constructor(props: IAccordionGroupProps) {
        super(props);

        this.isAccordionOpenedAt = this.isAccordionOpenedAt.bind(this);
        this.toggleAccordionAt = this.toggleAccordionAt.bind(this);
        this.renderAccordion = this.renderAccordion.bind(this);


        const { initialOpenedIndex } = props;
        this.state = {
            openedIndexes: initialOpenedIndex !== undefined ? [initialOpenedIndex] : [],
        };
    }

    public isAccordionOpenedAt(index: number): boolean {
        return this.state.openedIndexes.indexOf(index) > -1;
    }

    public closeAll(setStateCallback: () => void): void {
        this.setState({
            openedIndexes: [],
        }, setStateCallback);
    }

    public toggleAccordionAt(index: number): void {
        const { isMultiOpen, onChangeOpenIndexes } = this.props;
        const { openedIndexes } = this.state;
        const isIndexOpen = openedIndexes.indexOf(index) > -1;
        let newOpenedIndexes;
        if (!isMultiOpen) {
            newOpenedIndexes = isIndexOpen ? [] : [index];
        } else {
            newOpenedIndexes = isIndexOpen ?
                openedIndexes.filter(value => value !== index) :
                openedIndexes.concat([index]);
        }
        this.setState({ openedIndexes: newOpenedIndexes });
        if (onChangeOpenIndexes) {
            onChangeOpenIndexes([index]);
        }
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public renderAccordion(accordion, index: number) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return React.cloneElement(accordion as React.ReactElement<any>, {
            isOpened: this.isAccordionOpenedAt(index),
            onToggle: () => this.toggleAccordionAt(index),
        });
    }

    public render(): JSX.Element {
        const { children } = this.props;

        return (
            <div className="accordion-group">
                {React.Children.map(children, this.renderAccordion)}
            </div>
        );
    }
}

export default AccordionGroup;
