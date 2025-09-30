import * as React from "react";
import Button from "../../../src/elements/button";
import Modal from "../../../src/elements/modal";
import { create } from "react-test-renderer";
import { mount } from "enzyme";
import wrapWithTheme from "../../themeHelper";

const TITLE = "Vegetables & fruit";
const CONTENT = "Buy here! You're favourite fruit and vegetables";

function empty() {
    return;
}

const createEmptyModal = () => wrapWithTheme(<Modal />);
const createHiddenModal = () => wrapWithTheme(<Modal hidden={true} />);
const createModalWithTitle = title => wrapWithTheme(<Modal title={title} />);
const createModalWithContentAndTitle = (title, content) => (
    wrapWithTheme(<Modal title={title}>
        <p>{content}</p>
    </Modal>)
);
const createModalWithButtons = () => {
    const buttons = [wrapWithTheme(<Button text="apple" onClick={empty} />), wrapWithTheme(<Button text="cherry" onClick={empty}/>)];
    return wrapWithTheme(<Modal buttons={buttons}>Save changes?</Modal>);
};
const createModalWithoutPadding = () => (
    wrapWithTheme(<Modal withoutPadding={true}>
        <table className="showcase-modal-table">
            <tr>
                <th>Color</th>
                <th>Fruits</th>
            </tr>
            <tr>
                <td>Red</td>
                <td>Apples, cherries, ...</td>
            </tr>
            <tr>
                <td>Green</td>
                <td>Green apples</td>
            </tr>
            <tr>
                <td>Orange</td>
                <td>oranges, mandarines, ...</td>
            </tr>
        </table>
    </Modal>)
);

// most preferred
describe("Modal", () => {
    test("Empty modal (snapshot)", () => {
        const modal = create(createEmptyModal());
        const serialized = modal.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("Empty hidden modal (snapshot)", () => {
        const modal = create(createHiddenModal());
        const serialized = modal.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("Modal with title (snapshot)", () => {
        const modal = create(createModalWithTitle(TITLE));
        const serialized = modal.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("Modal with title and content with padding (snapshot)", () => {
        const modal = create(createModalWithContentAndTitle(TITLE, CONTENT));
        const serialized = modal.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("Modal with title and table without padding (snapshot)", () => {
        const modal = create(createModalWithoutPadding());
        const serialized = modal.toJSON();
        expect(serialized).toMatchSnapshot();
    });

    test("Modal title (mount: enzyme+jsdom)", () => {
        const elementText = mount(createModalWithTitle(TITLE))
            .find(".modal-header > h3")
            .at(0)
            .text();
        expect(elementText).toEqual(TITLE);
    });

    test("Modal title (mount: enzyme+jsdom)", () => {
        const elementText = mount(createModalWithContentAndTitle(TITLE, CONTENT))
            .find(".modal-body > p")
            .at(0)
            .text();
        expect(elementText).toEqual(CONTENT);
    });

    test("Modal buttons (mount: enzyme+jsdom)", () => {
        const buttons = mount(createModalWithButtons()).find(".modal-footer > ul > li").length;
        expect(buttons).toEqual(2);
    });
});
