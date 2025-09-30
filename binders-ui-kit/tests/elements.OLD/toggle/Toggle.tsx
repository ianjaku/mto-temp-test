import * as React from "react";
import Toggle from "../../../src/elements/toggle/Toggle";
import { create } from "react-test-renderer";
import { mount } from "enzyme";
import wrapWithTheme from "../../themeHelper";

const emptyAction = () => ({});
const createToggle = () => wrapWithTheme(<Toggle onToggle={emptyAction} />);
const createToggledToggle = () => wrapWithTheme(<Toggle isToggled={true} onToggle={emptyAction} />);

describe("Toggle", () => {
    test("Default toggle (snapshot)", () => {
        const toggle = create(createToggle());
        const serialized = toggle.toJSON();
        expect(serialized).toMatchSnapshot();
    });
    test("Toggled toggle (snapshot)", () => {
        const toggle = create(createToggledToggle());
        const serialized = toggle.toJSON();
        expect(serialized).toMatchSnapshot();
    });
    test("Toogle has is-toggle when toggled (mount: enzyme+jsdom)", () => {
        const toggle = mount(createToggledToggle());
        const isToggled = toggle.find(".toggle-button").hasClass("is-toggled");
        expect(isToggled).toEqual(true);
    });
    test("Toogle has not is-toggle when not toggled (mount: enzyme+jsdom)", () => {
        const toggle = mount(createToggle());
        const isToggled = toggle.find(".toggle-button").hasClass("is-toggled");
        expect(isToggled).toEqual(false);
    });
});
