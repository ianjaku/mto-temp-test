import * as React from "react";
import { Accordion, AccordionGroup } from "../../../src/elements/accordion";
import { create } from "react-test-renderer";
import { mount } from "enzyme";
import wrapWithTheme from "../../themeHelper";

const DEFAULT_HEADER = "Default Header";

const makeAccordionHeader = (content: string) => <div>{content}</div>;

const createAccordion = (isOpened = false) => (
    wrapWithTheme(<Accordion isOpened={isOpened} header={makeAccordionHeader(DEFAULT_HEADER)}>
        <div>{DEFAULT_HEADER}</div>
    </Accordion>)
);

const createAccordionGroup = (isMultiOpen = false, initialOpenedIndex: number = undefined) => (
    wrapWithTheme(<AccordionGroup isMultiOpen={isMultiOpen} initialOpenedIndex={initialOpenedIndex}>
        <Accordion header={makeAccordionHeader("Header #1")}>
            <div>Content #1</div>
        </Accordion>
        <Accordion header={makeAccordionHeader("Header #2")}>
            <div>Content #2</div>
        </Accordion>
        <Accordion header={makeAccordionHeader("Header #3")}>
            <div>Content #3</div>
        </Accordion>
    </AccordionGroup>)
);

describe("Accordion", () => {
    test("Closed Accordion (snapshot)", () => {
        const accordion = create(createAccordion());
        const serialized = accordion.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("Opened Accordion (snapshot)", () => {
        const accordion = create(createAccordion(true));
        const serialized = accordion.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("Accordion Group (snapshot)", () => {
        const accordion = create(createAccordionGroup());
        const serialized = accordion.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("Closed Accordion children visibility (shallow: enzyme+jsdom)", () => {
        const accordion = mount(createAccordion());
        const accordionBody = accordion.find(".accordion-body").exists();
        expect(accordionBody).toBe(false);
    });

    test("Opened Accordion children visibility (shallow: enzyme+jsdom)", () => {
        const visible = true;
        const accordion = mount(createAccordion(visible));
        const accordionBody = accordion.find(".accordion-body").exists();
        expect(accordionBody).toBe(true);
    });

    test("All closed Accordion Group (shallow: enzyme+jsdom)", () => {
        const accordion = mount(createAccordionGroup());
        const accordionHeaders = accordion.find(".accordion-header");
        const accordionBodies = accordion.find(".according-body");
        expect(accordionHeaders).toHaveLength(3);
        expect(accordionBodies).toHaveLength(0);
    });

    test("One Accordion from a Group should be open if initialOpenedIndex is set (mount: enzyme+jsdom)", () => {
        const isMultiOpen = false;
        const initialOpenedIndex = 1;
        const accordion = mount(createAccordionGroup(isMultiOpen, initialOpenedIndex));
        const accordionHeaders = accordion.find(".accordion-header");
        const accordionBodies = accordion.find(".accordion-body");
        expect(accordionHeaders).toHaveLength(3);
        expect(accordionBodies).toHaveLength(1);
    });

    test("One Accordion from a Group should open when a header is clicked and then closed (mount: enzyme+jsdom)", () => {
        const accordion = mount(createAccordionGroup());
        const accordionHeaders = accordion.find(".accordion-header");
        const accordionBodies = accordion.find(".accordion-body");
        expect(accordionHeaders).toHaveLength(3);
        expect(accordionBodies).toHaveLength(0);
        const firstAccordionHeader = accordionHeaders.get(0);
        firstAccordionHeader.props.onClick({ target: null });
        accordion.update();
        expect(accordion.find(".accordion-body")).toHaveLength(1);
        firstAccordionHeader.props.onClick({ target: null });
        accordion.update();
        expect(accordion.find(".accordion-body")).toHaveLength(0);
    });

    test("Multi open accordions should open and close correctly (shallow: enzyme+jsdom)", () => {
        const accordion = mount(createAccordionGroup(true, undefined));
        const accordionHeaders = accordion.find(".accordion-header");
        const accordionBodies = accordion.find(".accordion-body");
        expect(accordionHeaders).toHaveLength(3);
        expect(accordionBodies).toHaveLength(0);
        const firstAccordionHeader = accordionHeaders.get(0);
        firstAccordionHeader.props.onClick({ target: null });
        accordion.update();
        expect(accordion.find(".accordion-body")).toHaveLength(1);
        const secondAccordionHeader = accordionHeaders.get(1);
        secondAccordionHeader.props.onClick({ target: null });
        accordion.update();
        expect(accordion.find(".accordion-body")).toHaveLength(2);
        secondAccordionHeader.props.onClick({ target: null });
        accordion.update();
        expect(accordion.find(".accordion-body")).toHaveLength(1);
    });
});
