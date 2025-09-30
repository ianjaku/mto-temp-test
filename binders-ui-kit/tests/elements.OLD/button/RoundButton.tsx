import * as React from "react";
import AddChunkButton from "../../../src/elements/button/AddChunk";
import MergeChunkButton from "../../../src/elements/button/MergeChunk";
import { create } from "react-test-renderer";
import { mount } from "enzyme";
import wrapWithTheme from "../../themeHelper";

const createMergeChunkButton = callback => wrapWithTheme(<MergeChunkButton onClick={callback} />);
const createAddChunkButton = callback => wrapWithTheme(<AddChunkButton onClick={callback} />);

describe("Rounded button", () => {
    test("Merge chunk button (snapshot)", () => {
        const modal = create(createMergeChunkButton(undefined));
        const serialized = modal.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("Add chunk button (snapshot)", () => {
        const modal = create(createAddChunkButton(undefined));
        const serialized = modal.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("Merge chunk button (functional)", () => {
        const callback = jest.fn();

        const dom = mount(createMergeChunkButton(callback));
        const button = dom.find(".button-merge-chunks").at(0);
        button.simulate("click");
        expect(callback.mock.calls.length).toEqual(1);
    });

    test("Add chunk button (functional)", () => {
        const callback = jest.fn();

        const dom = mount(createAddChunkButton(callback));
        const button = dom.find(".button-add-chunk").at(0);
        button.simulate("click");
        expect(callback.mock.calls.length).toEqual(1);
    });
});
