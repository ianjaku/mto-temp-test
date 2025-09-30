import * as React from "react";
import Dropdown from "../../../src/elements/dropdown";
import { create } from "react-test-renderer";
import { mount } from "enzyme";
import wrapWithTheme from "../../themeHelper";

const TYPE = "testtype";
const ELEMENT1 = { id: 1, label: "element 1"};
const ELEMENT2 = { id: 2, label: "element 2"};
const ELEMENTS = [ ELEMENT1, ELEMENT2];
const AVATAR_ELEMENT1 = { id: 1, label: "account 1", avatar: "http://path.to/image1.jpg"};
const AVATAR_ELEMENT2 = { id: 2, label: "account 2", avatar: "http://path.to/image2.jpg"};
const AVATAR_ELEMENTS = [ AVATAR_ELEMENT1, AVATAR_ELEMENT2];

const getTestElements = () => ELEMENTS;
const getAvatarElements = () => AVATAR_ELEMENTS;


const createDefaultDropdown = (open) => wrapWithTheme(<Dropdown type={TYPE} elements={getTestElements()} open={open}/>);
const createDropup = () => wrapWithTheme(<Dropdown type={TYPE} elements={getTestElements()} />);
const createDropdownWithSelectedElement = () => wrapWithTheme(<Dropdown type={TYPE} elements={getTestElements()} selectedElementId={ELEMENT2.id} />);
const createDropupWithAvatarsAndHorizontalRules = (open) => wrapWithTheme(<Dropdown type={TYPE} elements={getAvatarElements()} selectedElementId={AVATAR_ELEMENT1.id} horizontalRulePositions={[1]} open={open} />);

// snapshots
test("Default dropdown closed (snapshot)", () => {
    const dropdown =  create(createDefaultDropdown(false));
    const serialized = dropdown.toJSON();
    expect(serialized).toMatchSnapshot();
});
test("Default dropdown open (snapshot)", () => {
    const dropdown =  create(createDefaultDropdown(true));
    const serialized = dropdown.toJSON();
    expect(serialized).toMatchSnapshot();
});
test("dropup (snapshot)", () => {
    const dropdown = create(createDropup());
    const serialized = dropdown.toJSON();
    expect(serialized).toMatchSnapshot();
});
test("dropdown with selected elemnent (snapshot)", () => {
    const dropdown = create(createDropdownWithSelectedElement());
    const serialized = dropdown.toJSON();
    expect(serialized).toMatchSnapshot();
});
test("dropdown with avatars and horizontal rules (snapshot)", () => {
    const dropdown = create(createDropupWithAvatarsAndHorizontalRules(true));
    const serialized = dropdown.toJSON();
    expect(serialized).toMatchSnapshot();
});

// enzyme
test("Default dropdown closed (mount: enzyme+jsdom)", () => {
    const ddMount = mount(createDefaultDropdown(false));
    const dropdownFieldLabel = ddMount
        .find(".dropdown-field-label-group-text")
        .first()
        .text();
    expect(dropdownFieldLabel).toEqual(TYPE);
    const elementsListItems = ddMount.find(".dropdown-elements li");
    expect(elementsListItems).toHaveLength(0);
});

// enzyme
test("Default dropdown open (mount: enzyme+jsdom)", () => {
    const ddMount = mount(createDefaultDropdown(true));
    const elementsListItems = ddMount.find(".dropdown-elements li");
    expect(elementsListItems).toHaveLength(ELEMENTS.length);
    const firstElementText = ddMount
        .find(".dropdown-elements li")
        .first()
        .text();
    expect(firstElementText).toEqual(ELEMENT1.label);
});

test("Dropdown with selected element id (mount: enzyme+jsdom)", () => {
    const ddMount = mount(createDropdownWithSelectedElement());
    const dropdownFieldLabel = ddMount
        .find(".dropdown-field-label-group-text")
        .first()
        .text();
    expect(dropdownFieldLabel).toEqual(ELEMENT2.label);
});

test("Dropdown with avatars closed (mount: enzyme+jsdom)", () => {
    const ddMount = mount(createDropupWithAvatarsAndHorizontalRules(false));
    const dropdownFieldLabel = ddMount
        .find(".dropdown-field-label-group-text")
        .first()
        .text();
    const dropdownFieldAvatar = ddMount
        .find(".avatar")
        .first()
        .prop("src");
    expect(dropdownFieldLabel).toEqual(AVATAR_ELEMENT1.label);
    expect(dropdownFieldAvatar).toEqual(AVATAR_ELEMENT1.avatar);
});

test("Dropdown with avatars open (mount: enzyme+jsdom)", () => {
    const ddMount = mount(createDropupWithAvatarsAndHorizontalRules(true));
    const hrType = ddMount
        .find(".dropdown-elements")
        .children()
        .at(1)
        .type();
    expect(hrType).toEqual("hr");
});
