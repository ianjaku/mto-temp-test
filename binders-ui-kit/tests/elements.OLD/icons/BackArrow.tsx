import * as React from "react";
import BackArrow, { ICON_NAME } from "../../../src/elements/icons/BackArrow";
import { create } from "react-test-renderer";
import { mount } from "enzyme";
import wrapWithTheme from "../../themeHelper";

test("Back arrow (snapshot)", () => {
    const backArrow = create(wrapWithTheme(<BackArrow />));
    const serialized = backArrow.toJSON();
    expect(serialized).toMatchSnapshot();
});

test("Back arrow (mount: enzyme+jsdom)", () => {
    const elementText = mount(wrapWithTheme(<BackArrow />))
        .find(".material-icons")
        .at(0)
        .text();
    expect(elementText).toEqual(ICON_NAME);
});

// test("Back arrow (shallow)", () => {
//     const elements = shallow(wrapWithTheme(<BackArrow />));
//     expect(elements.length).toEqual(1);
//     const element = elements.first();
//     expect(element.props().use).toEqual(ICON_NAME);
// });
