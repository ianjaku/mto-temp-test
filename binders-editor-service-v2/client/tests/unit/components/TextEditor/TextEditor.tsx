import * as React from "react";
import { act, fireEvent, render } from "@testing-library/react";
import {
    INITIALIZATION_WINDOW
} from "../../../../src/documents/Composer/components/BinderLanguage/TextEditor/custom-tiptap-extensions/InitializationTracker";
import { TextEditor } from "@binders/editor-v2-client/src/documents/Composer/components/BinderLanguage/TextEditor";

const EDITOR_CLASS_NAME = ".tiptap";

function spoofGetClientRects() {
    // spoof getClientRects to avoid TypeError: target.getClientRects is not a function (https://github.com/ueberdosis/tiptap/discussions/4008)
    function getBoundingClientRect(): DOMRect {
        const rec = {
            x: 0,
            y: 0,
            bottom: 0,
            height: 0,
            left: 0,
            right: 0,
            top: 0,
            width: 0,
        };
        return { ...rec, toJSON: () => rec };
    }
    class FakeDOMRectList extends Array<DOMRect> implements DOMRectList {
        item(index: number): DOMRect | null {
            return this[index];
        }
    }
    document.elementFromPoint = (): null => null;
    HTMLElement.prototype.getBoundingClientRect = getBoundingClientRect;
    HTMLElement.prototype.getClientRects = (): DOMRectList =>
        new FakeDOMRectList();
    Range.prototype.getBoundingClientRect = getBoundingClientRect;
    Range.prototype.getClientRects = (): DOMRectList =>
        new FakeDOMRectList();
}

describe("TextEditor Component", () => {
    beforeAll(() => {
        spoofGetClientRects();
    })
    it("should start with default content", async () => {
        const { container } = render(
            <TextEditor
                isFocused={false}
                onFocus={jest.fn()}
                textModule={{ json: "" }}
                onChange={() => { }}
            />
        );
        const element = container.querySelector(EDITOR_CLASS_NAME);
        expect(element).toBeInTheDocument();
    });

    it("should call custom onFocus function on focus", async () => {
        const onFocus = jest.fn();
        const { container } = render(
            <TextEditor
                isFocused={false}
                onFocus={onFocus}
                textModule={{ json: "" }}
                onChange={() => { }}
            />
        );
        const element = container.querySelector(EDITOR_CLASS_NAME);
        fireEvent.focus(element);
        expect(onFocus).toHaveBeenCalled();
    });

    it("should contain content injected with json", async () => {
        const onFocus = jest.fn();
        const { container } = render(
            <TextEditor
                isFocused={false}
                onFocus={onFocus}
                textModule={{ json: "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Chunk 1\"}]}]}" }}
                onChange={() => { }}
            />
        );
        const element = container.querySelector(EDITOR_CLASS_NAME);
        expect(element).toBeInTheDocument();
        expect(element).toHaveTextContent("Chunk 1");
    });

    it("should call custom onChange function on change", async () => {
        jest.useFakeTimers();
        const onChange = jest.fn();
        const { container } = render(
            <TextEditor
                isFocused={false}
                onFocus={() => { }}
                textModule={{ json: undefined }}
                onChange={onChange}
            />
        );

        // Wait for initialization period to pass (more dedicated test in InitializationTracker.ts)
        act(() => {
            jest.advanceTimersByTime(INITIALIZATION_WINDOW + 50);
        });

        const element = container.querySelector(EDITOR_CLASS_NAME);
        fireEvent.focus(element);
        fireEvent.click(element);
        await act(async () => {
            await fireEvent.input(element, { target: { innerHTML: "<p>Chunk 1</p>" } });
        });
        expect(onChange).toHaveBeenCalledWith(
            "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Chunk 1\"}]}]}",
            "<p>Chunk 1</p>",
        );
        jest.useRealTimers();
    });

});