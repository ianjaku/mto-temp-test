import * as React from "react";
import Tooltip, { TooltipPosition, showTooltip } from "../../../src/elements/tooltip/Tooltip";
import { create } from "react-test-renderer";
import { mount } from "enzyme";
import wrapWithTheme from "../../themeHelper";

const MESSAGE = "Hello, I'm a tooltip!";
const BOUNDING_RECT = { width: 100, height: 50, left: 110, top: 60, right: 0, bottom: 0 };

const createTooltip = () => wrapWithTheme(<Tooltip message={MESSAGE} />);
const createActionableTooltip = (position: TooltipPosition = TooltipPosition.TOP) => (
    wrapWithTheme(<ActionableTooltip position={position} />)
);


describe("Tooltip", () => {
    test("Tooltip (snapshot)", () => {
        const tooltip = create(createTooltip());
        const serialized = tooltip.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("Actionable Tooltip (snapshot)", () => {
        const tooltip = create(createActionableTooltip());
        const serialized = tooltip.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("Tooltip text (mount: enzyme+jsdom)", () => {
        const tooltip = mount(createTooltip());
        const tooltipElement = tooltip.find(".tooltip > span").at(0);
        const tooltipText = tooltipElement.text();
        expect(tooltipText).toEqual(MESSAGE);
    });

    test("Tooltip visibility toggle (mount: enzyme+jsdom)", () => {
        const component = mount(createActionableTooltip());
        const style = getMockedStyleForTooltip(component);

        expect(style).toHaveProperty("visibility", "visible");
    });

    test("Tooltip top position (mount: enzyme+jsdom)", () => {
        const component = mount(createActionableTooltip());
        const style = getMockedStyleForTooltip(component);
        const top = BOUNDING_RECT.top - BOUNDING_RECT.height;
        expect(style).toHaveProperty("top", `${top}px`);
        expect(style).toHaveProperty("left", `${BOUNDING_RECT.left}px`);
    });

    test("Tooltip left position (mount: enzyme+jsdom)", () => {
        const component = mount(createActionableTooltip(TooltipPosition.BOTTOM));
        const style = getMockedStyleForTooltip(component);
        const top = BOUNDING_RECT.top + BOUNDING_RECT.height;
        expect(style).toHaveProperty("top", `${top}px`);
        expect(style).toHaveProperty("left", `${BOUNDING_RECT.left}px`);
    });

    test("Tooltip left position (mount: enzyme+jsdom)", () => {
        const component = mount(createActionableTooltip(TooltipPosition.LEFT));
        const style = getMockedStyleForTooltip(component);

        expect(style).toHaveProperty("top", `${BOUNDING_RECT.top}px`);
        expect(style).toHaveProperty("left", `${BOUNDING_RECT.left}px`);
    });

    test("Tooltip left position (mount: enzyme+jsdom)", () => {
        const component = mount(createActionableTooltip(TooltipPosition.RIGHT));
        const style = getMockedStyleForTooltip(component);
        const left = BOUNDING_RECT.left + BOUNDING_RECT.width;
        expect(style).toHaveProperty("top", `${BOUNDING_RECT.top}px`);
        expect(style).toHaveProperty("left", `${left}px`);
    });
});

function getMockedStyleForTooltip(component): void {
    const button = component.find("button").get(0);
    button.props.onClick({ target: { getBoundingClientRect: () => BOUNDING_RECT } });
    component.update();
    return component.find(".tooltip").get(0).props.style;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class ActionableTooltip extends React.Component<{ position: TooltipPosition; }, any> {
    private tooltip: Tooltip;

    constructor(props) {
        super(props);

        this.onClick = this.onClick.bind(this);
    }

    public onClick(e) {
        const { position } = this.props;
        showTooltip(e, this.tooltip, position);
    }

    public render() {
        return (
            <div>
                <Tooltip ref={ref => { this.tooltip = ref; }} message={MESSAGE} />
                <button onClick={this.onClick}>
                    Show tooltip
                </button>
            </div>
        );
    }
}
