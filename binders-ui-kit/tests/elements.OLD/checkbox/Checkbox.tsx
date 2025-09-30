/* eslint-disable @typescript-eslint/no-unused-vars */
import * as React from "react";
import Checkbox from "../../../src/elements/checkbox";
import { mount } from "enzyme";
import wrapWithTheme from "../../themeHelper";

const TITLE = "Checkbox title";
let exampleValue = 100;
const onClick = () => exampleValue++;



const createBaseCheckbox = () => wrapWithTheme(<Checkbox />);
const createBaseCheckboxChecked = () => wrapWithTheme(<Checkbox checked={true} />);
const createBaseCheckboxWithLabel = (text) => wrapWithTheme(<Checkbox label={text} />);
const createBaseCheckboxCheckedWithLabel = (text) => wrapWithTheme(<Checkbox label={text} checked={true} />);
const createBaseCheckboxDisabled = (text) => wrapWithTheme(<Checkbox label={text} disabled={true} />);
const createBaseCheckboxCallback = (text) => wrapWithTheme(<Checkbox label={text} onCheck={onClick} />);
const createBaseCheckboxCallbackDisabled = (text) => wrapWithTheme(<Checkbox label={text} disabled={true} onCheck={onClick} />);

describe("Checkbox", () => {

    beforeEach(() => {
        exampleValue = 100;
    });

    // not working with material-ui components :/
    // test("Base Checkbox (snapshot)", () => {
    //     const modal = create(createBaseCheckbox());
    //     const serialized = modal.toJSON();
    //     expect(serialized).toMatchSnapshot();
    // });

    // test("Base Checkbox Disabled (snapshot)", () => {
    //     const modal = create(createBaseCheckboxChecked());
    //     const serialized = modal.toJSON();
    //     expect(serialized).toMatchSnapshot();
    // });

    // test("Secondary Checkbox (snapshot)", () => {
    //     const modal = create(createBaseCheckboxWithLabel("With label"));
    //     const serialized = modal.toJSON();
    //     expect(serialized).toMatchSnapshot();
    // });

    // test("Secondary Checkbox disabled (snapshot)", () => {
    //     const modal = create(createBaseCheckboxDisabled("Disabled"));
    //     const serialized = modal.toJSON();
    //     expect(serialized).toMatchSnapshot();
    // });

    // test("CTA Checkbox (snapshot)", () => {
    //     const modal = create(createBaseCheckboxCallback("With Callback"));
    //     const serialized = modal.toJSON();
    //     expect(serialized).toMatchSnapshot();
    // });

    test("Checkbox text (mount: enzyme+jsdom)", () => {
        const elementText = mount(createBaseCheckboxWithLabel(TITLE))
            .find("label")
            .at(0)
            .text();
        expect(elementText).toEqual(TITLE);
    });

    test("Checkbox disabled class (mount: enzyme+jsdom)", () => {
        const cb = mount(createBaseCheckboxDisabled(TITLE))
            .find("input");
        expect(cb.prop("disabled")).toEqual(true);
    });

    test("Enabled Checkbox onClick (shallow: enzyme+jsdom)", () => {
        const cs = mount(createBaseCheckboxCallback(TITLE))
            .find("input")
            .simulate("click");
        expect(exampleValue).toEqual(101);
    });

    test("Disabled Checkbox onClick (shallow: enzyme+jsdom)", () => {
        const cb = mount(createBaseCheckboxCallbackDisabled(TITLE))
            .find("input")
            .simulate("click");
        expect(exampleValue).toEqual(100);
    });
});
