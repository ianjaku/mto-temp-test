import * as React from "react";
import Button from "../../../src/elements/button";
import { create } from "react-test-renderer";
import { mount } from "enzyme";
import wrapWithTheme from "../../themeHelper";

const TITLE = "Button title";
let exampleValue = 100;
const onClick = () => exampleValue++;

const createBaseButton = (text) => wrapWithTheme(<Button text={text} onClick={onClick} />);
const createBaseButtonDisabled = (text) => wrapWithTheme(<Button text={text} onClick={onClick} isEnabled={false} />);
const createSecondaryButton = (text) => wrapWithTheme(<Button text={text} onClick={onClick} secondary={true} />);
const createSecondaryButtonDisabled = (text) => wrapWithTheme(<Button text={text} onClick={onClick} secondary={true} isEnabled={false} />);
const createCTAButton = (text) => wrapWithTheme(<Button text={text} onClick={onClick} CTA={true} />);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const createCTAButtonDisabled = (text) => wrapWithTheme(<Button text="CTA Button Disabld" onClick={onClick} CTA={true} isEnabled={false} />);

describe("Button", () => {

    beforeEach(() => {
        exampleValue = 100;
    });


    test("Base Button (snapshot)", () => {
        const modal = create(createBaseButton("Base Button"));
        const serialized = modal.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("Base Button Disabled (snapshot)", () => {
        const modal = create(createBaseButtonDisabled("Base Button Disabled"));
        const serialized = modal.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("Secondary Button (snapshot)", () => {
        const modal = create(createSecondaryButton("Secondary Button"));
        const serialized = modal.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("Secondary Button disabled (snapshot)", () => {
        const modal = create(createSecondaryButtonDisabled("Secondary Button Disabled"));
        const serialized = modal.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("CTA Button (snapshot)", () => {
        const modal = create(createCTAButton("CTA Button"));
        const serialized = modal.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("CTA Button Disabled (snapshot)", () => {
        const modal = create(createCTAButtonDisabled("CTA Button Disabled"));
        const serialized = modal.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("Button text (mount: enzyme+jsdom)", () => {
        const elementText = mount(createCTAButton(TITLE))
            .find(".button")
            .at(0)
            .text();
        expect(elementText).toEqual(TITLE);
    });

    test("Button disabled class (mount: enzyme+jsdom)", () => {
        const button = mount(createBaseButton(TITLE))
            .find(".button");
        expect(button.hasClass("button--disabled"));
    });

    test("Enabled Button onClick (shallow: enzyme+jsdom)", () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const button = mount(createSecondaryButton(TITLE))
            .find(".button")
            .simulate("click");
        expect(exampleValue).toEqual(101);
    });

    test("Disabled Button onClick (shallow: enzyme+jsdom)", () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const button = mount(createSecondaryButtonDisabled(TITLE))
            .find(".button")
            .simulate("click");
        expect(exampleValue).toEqual(100);
    });
});
