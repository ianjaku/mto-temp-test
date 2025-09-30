import * as React from "react";
import ColorPicker from "../../../src/elements/colorpicker";
import { create } from "react-test-renderer";
import { mount } from "enzyme";

const createColorPicker = () => <ColorPicker onColorSelect={undefined} defaultHexColor="#BADA55" />;

// snapshots
test("Color picker (snapshot)", () => {
    const fm1 = create(createColorPicker());
    const serialized = fm1.toJSON();
    expect(serialized).toMatchSnapshot();
});

// enzyme
test("Color picker default color (mount: enzyme+jsdom)", () => {
    const cpMount = mount(createColorPicker());
    const swatch = cpMount.find(".colorpicker-swatch").first();
    expect(swatch.props().style.backgroundColor).toEqual("#BADA55");
});
