import * as React from "react";
import Loader from "../../../src/elements/loader";
import { mount } from "enzyme";
import wrapWithTheme from "../../themeHelper";

const DEFAULT_LOADING_MESSAGE = "Loading...";
const CUSTOM_LOADING_MESSAGE = "Custom loading message";

const createLoader = () => wrapWithTheme(<Loader />);
const createCustomLoader = (text, className = "", enabled = true) => wrapWithTheme(
    <Loader
        text={text}
        className={className}
        textEnabled={enabled}
    />,
);

describe("Loader", () => {

    test("Loader default props (mount: enzyme+jsdom)", () => {
        const loader = mount(createLoader());
        const textElement = loader.find(".loader > span").at(0);
        expect(textElement.exists()).toEqual(true);
        expect(textElement.text()).toEqual(DEFAULT_LOADING_MESSAGE);
    });

    test("Loader custom text (mount: enzyme+jsdom)", () => {
        const loader = mount(createCustomLoader(CUSTOM_LOADING_MESSAGE));
        const textElement = loader.find(".loader > span").at(0);
        expect(textElement.exists()).toEqual(true);
        expect(textElement.text()).toEqual(CUSTOM_LOADING_MESSAGE);
    });

    test("Loader custom className (mount: enzyme+jsdom)", () => {
        const loader = mount(createCustomLoader(CUSTOM_LOADING_MESSAGE, "custom-class"));
        const textElement = loader.find(".loader.custom-class > span").at(0);
        expect(textElement.exists()).toEqual(true);
        expect(textElement.text()).toEqual(CUSTOM_LOADING_MESSAGE);
    });

    test("Loader custom textEnabled (mount: enzyme+jsdom)", () => {
        const loader = mount(createCustomLoader(CUSTOM_LOADING_MESSAGE, "custom-class", false));
        const textElement = loader.find(".loader.custom-class > span").at(0);
        expect(textElement.exists()).toEqual(false);
    });
});
