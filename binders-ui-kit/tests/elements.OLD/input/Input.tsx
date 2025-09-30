import * as React from "react";
import AccountIcon from "../../../src/elements/icons/Account";
import Input from "../../../src/elements/input";
import InputWithIcon from "../../../src/elements/input/InputWithIcon";
import SearchInput from "../../../src/elements/input/SearchInput";
import { create } from "react-test-renderer";
import { mount } from "enzyme";
import wrapWithTheme from "../../themeHelper";

const CONTENT = "Search for documents and collections";
const EMAIL = "john.doe@manual.to";
const PLACEHOLDER = "your name";

const createEmptyTextInput = () => wrapWithTheme(<Input type="text" />);
const createContentPasswordInput = () => wrapWithTheme(<Input type="password" value={CONTENT} />);
const createContentIconInput = () => wrapWithTheme(<InputWithIcon type="email" value={EMAIL} icon={<AccountIcon />} />);
const createSearchInput = () => wrapWithTheme(<SearchInput name="search" />);
const createDisabledInput = () => wrapWithTheme(<Input disabled={true} name="full_name" />);
const createInputWithPlaceholder = () => wrapWithTheme(<Input placeholder={PLACEHOLDER} type="text" name="full_name" />);
const createInvertedSearchInput = () => wrapWithTheme(<SearchInput name="search" inverted={true} />);

// most preferred
describe("Input", () => {

    test("Empty text input (snapshot)", () => {
        const input = create(createEmptyTextInput()).toJSON();
        expect(input).toMatchSnapshot();
    });

    test("Content password input (snapshot)", () => {
        const input = create(createContentPasswordInput()).toJSON();
        expect(input).toMatchSnapshot();
    });

    test("Content icon input (snapshot)", () => {
        const input = create(createContentIconInput()).toJSON();
        expect(input).toMatchSnapshot();
    });

    test("Search input (snapshot)", () => {
        const input = create(createSearchInput()).toJSON();
        expect(input).toMatchSnapshot();
    });

    test("Disabled text input (snapshot)", () => {
        const input = create(createDisabledInput()).toJSON();
        expect(input).toMatchSnapshot();
    });

    test("Input with placeholder (snapshot)", () => {
        const input = create(createInputWithPlaceholder()).toJSON();
        expect(input).toMatchSnapshot();
    });

    test("Inverted search input (snapshot)", () => {
        const input = create(createInvertedSearchInput()).toJSON();
        expect(input).toMatchSnapshot();
    });

    test("Input should be of type text and be empty (mount: enzyme+jsdom)", () => {
        const element = mount(createEmptyTextInput())
            .find(".input")
            .at(0);
        expect(element.exists()).toEqual(true);
        expect(element.prop("type")).toEqual("text");
        expect(element.text()).toEqual("");
    });

    test("Password input should contain a value and be of type password (mount: enzyme+jsdom)", () => {
        const element = mount(createContentPasswordInput())
            .find(".input")
            .at(0);
        expect(element.exists()).toEqual(true);
        expect(element.prop("type")).toEqual("password");
        expect(element.prop("value")).toEqual(CONTENT);
    });

    test("Content icon input should contain an account icon and in this case be of type email (mount: enzyme+jsdom)", () => {
        const element = mount(createContentIconInput())
            .find(".input")
            .at(0);
        expect(element.exists()).toEqual(true);
        expect(element.prop("type")).toEqual("email");
        expect(element.prop("value")).toEqual(EMAIL);

        const icon = element.find(".input-icon");
        expect(icon.exists());
    });


    test("Search input should have a search icon and here name search (mount: enzyme+jsdom)", () => {
        const element = mount(createSearchInput())
            .find(".input-wrapper-search .input");
        expect(element.exists()).toEqual(true);
        expect(element.prop("type")).toEqual("text");
        expect(element.prop("name")).toEqual("search");

        const icon = element.find(".input-icon");
        expect(icon.exists());
    });

    test("Disabled textbox should be disabled (mount: enzyme+jsdom)", () => {
        const element = mount(createDisabledInput())
            .find(".input")
            .at(0);
        expect(element.prop("disabled")).toEqual(true);
        expect(element.prop("name")).toEqual("full_name");
    });

    test("Placeholder should work (mount: enzyme+jsdom)", () => {
        const element = mount(createInputWithPlaceholder())
            .find(".input")
            .at(0);
        expect(element.prop("placeholder")).toEqual(PLACEHOLDER);
        expect(element.prop("name")).toEqual("full_name");
        expect(element.prop("type")).toEqual("text");
    });

    test("Inverted search input (mount: enzyme+jsdom)", () => {
        const element = mount(createInvertedSearchInput())
            .find(".input")
            .at(0);
        expect(element.prop("className")).toEqual("input input--inverted");
    });
});
