import * as React from "react"
import {
    Component,
    ComponentType,
    MouseEvent,
    ReactElement,
} from "react";

interface EntryProps {
    emoji: string;
    onEmojiSelect(emoji: string): void;
    index: number;
    onEmojiFocus(index: number): void;
    isFocused: boolean;
    id: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    emojiImage: ComponentType<any>;
}

export default class Entry extends Component<EntryProps> {
    mouseDown = false;

    componentDidUpdate(): void {
        this.mouseDown = false;
    }

    onMouseUp = (): void => {
        if (this.mouseDown) {
            this.mouseDown = false;
            this.props.onEmojiSelect(this.props.emoji);
        }
    };

    onMouseDown = (event: MouseEvent): void => {
        // Note: important to avoid a content edit change
        event.preventDefault();

        this.mouseDown = true;
    };

    onMouseEnter = (): void => {
        this.props.onEmojiFocus(this.props.index);
    };

    render(): ReactElement {
        const { emoji, isFocused, id, emojiImage: EmojiImage } = this.props;
        const className = isFocused ?
            "emojiSuggestionsEntryFocused" :
            "emojiSuggestionsEntry";

        return (
            <div
                className={className}
                onMouseDown={this.onMouseDown}
                onMouseUp={this.onMouseUp}
                onMouseEnter={this.onMouseEnter}
                role="option"
                id={id}
                aria-selected={isFocused ? "true" : undefined}
            >
                <EmojiImage emoji={emoji} />
                <span className={"emojiSuggestionsEntryText"}>
                    {this.props.emoji}
                </span>
            </div>
        );
    }
}
