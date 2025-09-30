import * as React from "react";
import FlashMessage, { FlashMessageType } from "../../../src/elements/flashmessage";
import { create } from "react-test-renderer";
import { mount } from "enzyme";
import wrapWithTheme from "../../themeHelper";

const MESSAGE_SUCCESS = "A success message";
const MESSAGE_INFO = "An info message";
const MESSAGE_ERROR = "An error message";

let flashMessageDismissed = false;

const dismissFlashMessage = () => flashMessageDismissed = true;


const createSuccessFM = () => wrapWithTheme(<FlashMessage type={FlashMessageType.SUCCESS} message={MESSAGE_SUCCESS} open={true} />);
const createInfoFM = () => wrapWithTheme(<FlashMessage type={FlashMessageType.INFO} message={MESSAGE_INFO} open={true} />);
const createErrorFM = () => wrapWithTheme(<FlashMessage type={FlashMessageType.ERROR} message={MESSAGE_ERROR} open={true} onHide={dismissFlashMessage} />);

// snapshots
test("Success flash message (snapshot)", () => {
    const fm1 = create(createSuccessFM());
    const serialized = fm1.toJSON();
    expect(serialized).toMatchSnapshot();
});
test("Info flash message (snapshot)", () => {
    const fm2 = create(createInfoFM());
    const serialized = fm2.toJSON();
    expect(serialized).toMatchSnapshot();
});
test("Error flash message (snapshot)", () => {
    const fm3 = create(createErrorFM());
    const serialized = fm3.toJSON();
    expect(serialized).toMatchSnapshot();
});

// enzyme
test("Success flash message (mount: enzyme+jsdom)", () => {
    const fmMount = mount(createSuccessFM());
    const flashMessage = fmMount.find(".flashmessage").first();
    const message = flashMessage.find(".message").first().text();
    expect(message).toEqual(MESSAGE_SUCCESS);
    expect(flashMessage.hasClass("success")).toEqual(true);
});

// enzyme
test("Info flash message (mount: enzyme+jsdom)", () => {
    const fmMount = mount(createInfoFM());
    const flashMessage = fmMount.find(".flashmessage").first();
    const message = flashMessage.find(".message").first().text();
    expect(message).toEqual(MESSAGE_INFO);
    expect(flashMessage.hasClass("info")).toEqual(true);
});

// enzyme
test("Error flash message (mount: enzyme+jsdom)", () => {
    const fmMount = mount(createErrorFM());
    const flashMessage = fmMount.find(".flashmessage").first();
    const message = flashMessage.find(".message").first().text();
    expect(message).toEqual(MESSAGE_ERROR);
    expect(flashMessage.hasClass("error")).toEqual(true);
});

test("Flash message hiding on clicking close (mount: enzyme+jsdom)", () => {
    const fmMount = mount(createErrorFM());
    expect(flashMessageDismissed).toEqual(false);
    fmMount.find(".close").first().simulate("click");
    expect(flashMessageDismissed).toEqual(true);
});
