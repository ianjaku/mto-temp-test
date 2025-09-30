import * as React from "react";
import { PaneProps } from "./Pane";
import cx from "classnames";
import { useEffect } from "react";
import "./Tabs.styl";

interface ITabsProps {
    initialSelectedIndex?: number;
    navHeight?: "auto" | "medium";
    noBg?: boolean;
    noContentPadding?: boolean;
    fullWidth?: boolean;
    TabsNavSlot?: React.ReactElement;
}

export const Tabs: React.FC<ITabsProps> = ({
    TabsNavSlot,
    children,
    fullWidth,
    initialSelectedIndex,
    navHeight,
    noBg,
    noContentPadding
}) => {

    const [ currentSelectedIndex, setCurrentSelectedIndex ] = React.useState(initialSelectedIndex ?? 0);
    useEffect(() => {
        setCurrentSelectedIndex(initialSelectedIndex ?? 0);
    }, [initialSelectedIndex]);

    const childrenArray = React.useMemo(() => React.Children.toArray(children).filter(Boolean), [children]);

    return (
        <section className="tabs">
            <section className={`tabs-nav ${navHeight ? `tabs-nav--${navHeight}` : ""}`}>
                <ul className={`tabs-nav-list ${fullWidth ? "tabs-nav-list--full-width" : ""}`}>
                    {childrenArray.map((child: { props: PaneProps }, index) => {
                        return (
                            <li
                                className={cx("tabs-item", { active: currentSelectedIndex === index })}
                                onClick={() => {
                                    const shouldBlockNavigationToIt = child.props?.onClick?.();
                                    if (shouldBlockNavigationToIt) return;
                                    setCurrentSelectedIndex(index);
                                }}
                                key={index}
                            >
                                <span className="tabs-title" data-testid={child.props.testId}>
                                    {child.props.label}
                                </span>
                            </li>
                        );
                    })}
                </ul>
                {TabsNavSlot ?? null}
            </section>
            <div className={cx(
                "tabs-content",
                {"tabs-content--no-bg": noBg},
                {"tabs-content--no-padding": noContentPadding},
                {"tabs-content--full-width": fullWidth},
            )}>
                {childrenArray[currentSelectedIndex]}
            </div>
        </section>
    );
};
