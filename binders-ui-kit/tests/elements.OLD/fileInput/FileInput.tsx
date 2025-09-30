import * as React from "react";
import FileInput from "../../../src/elements/fileselector";
import { create } from "react-test-renderer";
import { mount } from "enzyme";

const TEXT = "Select .csv file";
const ACCEPTED_LIST = [".csv", ".jpg", "image/*"];
const NAME = "finput";

const createFileInput = () => <FileInput name="finput" />;
const createFileInputCustomButtonText = () => (
    <FileInput name={NAME} buttonText={TEXT} accept={ACCEPTED_LIST} />
);
const createFileInputWithCallback = callback => <FileInput name="finput" onChange={callback} />;

// most preferred
describe("File Input", () => {
    test("Snapshot default file input", () => {
        const input = create(createFileInput()).toJSON();
        expect(input).toMatchSnapshot();
    });

    test("Name should be correct", () => {
        const element = mount(createFileInput());
        const comp = element.find(".file-input > label > input");
        expect(comp.prop("name")).toEqual(NAME);
        expect(comp.prop("type")).toEqual("file");
        expect(comp.prop("accept")).toEqual("*");
    });

    test("Accept can be modified", () => {
        const element = mount(createFileInputCustomButtonText());
        const comp = element.find(".file-input > label > input");
        expect(comp.prop("accept")).toEqual(ACCEPTED_LIST.join(","));
    });

    test("Button text can be set", () => {
        const element = mount(createFileInputCustomButtonText());
        const comp = element.find(".file-input > label");
        expect(comp.text()).toEqual(TEXT);
    });

    test("Callback works", () => {
        const callback = jest.fn();
        const element = mount(createFileInputWithCallback(callback));
        const comp = element.find(".file-input > label > input");

        // create file and test
        const fileContents = "file contents";
        const file = new Blob([fileContents], { type: "text/plain" });
        comp.simulate("change", { target: { files: [file] } });

        expect(callback.mock.calls.length).toEqual(1);
    });
});
