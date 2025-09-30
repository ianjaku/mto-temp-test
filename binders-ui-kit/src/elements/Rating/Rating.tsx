import * as React from "react";
import { FaIconStar } from "@binders/client/lib/react/icons/font-awesome";
import "./rating.styl";

const { useCallback, useState } = React;

export type RatingProps = {
    value?: number | null;
    onChange?: (value: number) => void;
    onReset?: () => void;
    max?: number;
    disabled?: boolean;
    width?: number
}

export const Rating: React.FC<RatingProps> = ({
    disabled,
    onChange,
    onReset,
    value,
    max = 5,
    width = 20
}) => {
    const [hovered, setHovered] = useState<number | null>(null);

    const hasRating = value != null;

    const ratingClick = useCallback((idx: number) => {
        if (disabled) return;
        if (value === idx + 1) {
            onReset?.();
        } else {
            onChange?.(idx + 1);
        }
    }, [disabled, onChange, onReset, value]);

    const starsMarkup = [...Array(max).keys()].map(i => {
        const isHovered = !disabled && hovered != null && hovered >= 0 && i <= hovered;
        const isHighlighted = isHovered ||  (!isHovered && hasRating && i + 1 <= value);
        let ratingButtonClassNames = "";
        if (isHighlighted) ratingButtonClassNames += " rating-point-button__highlighted";
        if (disabled) ratingButtonClassNames += " rating-point-button__disabled"
        return (
            <div key={i} className="rating-point">
                <button
                    className={`rating-point-button ${ratingButtonClassNames}`}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    onBlur={() => setHovered(i)}
                    onClick={() => ratingClick(i)}
                >
                    <FaIconStar
                        noFontAwesome
                        outline={!isHighlighted} w={width.toString()}
                    />
                </button>
            </div>
        );
    });
    return (
        <div
            className="rating-stars"
            onMouseLeave={() => setHovered(null)}
        >
            {starsMarkup}
        </div>
    )
}
