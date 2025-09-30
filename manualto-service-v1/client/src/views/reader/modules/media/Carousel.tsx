import * as React from "react";
import NukaCarousel from "nuka-carousel";
const { useCallback, useState } = React;

const renderCenterLeftControls = ({ currentSlide, previousSlide }) => {
    return (
        <button
            className={
                currentSlide === 0 ?
                    "carousel-arrow-button disabled" :
                    "carousel-arrow-button enabled"
            }
            onClick={previousSlide}
        >
            <span className="icon-home-wrapper">
                <i className="icon carousel-arrow carousel-arrow-left" />
            </span>
        </button>
    );
};

const renderCenterRightControls = ({ currentSlide, nextSlide, slidesToScroll, slideCount }) => {
    const isDisabled = currentSlide + slidesToScroll >= slideCount;
    return (
        <button
            className={isDisabled ? "carousel-arrow-button disabled" : "carousel-arrow-button enabled"}
            onClick={nextSlide}
        >
            <span className="icon-home-wrapper">
                <i className="icon carousel-arrow carousel-arrow-right" />
            </span>
        </button>
    );
}

interface ICarouselProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    children: (slideIndex: number) => any;
    onPositionChange: (newSlideIndex: number) => void;
}

const Carousel: React.FC<ICarouselProps> = (props) => {
    const { children, onPositionChange: onPositionChangeProps } = props;
    const [slideIndex, setSlideIndex] = useState(0);
    const onPositionChange = useCallback((newSlideIndex) => {
        setSlideIndex(newSlideIndex);
        onPositionChangeProps(newSlideIndex);
    }, [setSlideIndex, onPositionChangeProps]);

    return (
        <NukaCarousel
            renderCenterLeftControls={renderCenterLeftControls}
            renderCenterRightControls={renderCenterRightControls}
            afterSlide={onPositionChange}
        >
            {children(slideIndex)}
        </NukaCarousel>
    )
}

export default Carousel;
