import * as React from "react";
import CloseIcon, { ICON_NAME } from "../../../src/elements/icons/Close";
import { mount, shallow } from "enzyme";
import { create } from "react-test-renderer";
import wrapWithTheme from "../../themeHelper";

test("Close (snapshot)", () => {
    const closeIcon = create(wrapWithTheme(<CloseIcon />));
    const serialized = closeIcon.toJSON();
    expect(serialized).toMatchSnapshot();
});

test("Close (mount: enzyme+jsdom)", () => {
    const elementText = mount(wrapWithTheme(<CloseIcon />))
        .find(".material-icons")
        .at(0)
        .text();
    expect(elementText).toEqual(ICON_NAME);
});

test("Close (shallow)", () => {
    const elements = shallow(wrapWithTheme(CloseIcon({color: "#fff"})));
    expect(elements.length).toEqual(1);
    const element = elements.first();
    expect(element.props().color).toEqual("#fff");
});
