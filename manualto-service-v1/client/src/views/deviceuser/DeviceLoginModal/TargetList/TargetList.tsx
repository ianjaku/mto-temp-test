import * as React from "react";
import { AngleDown } from "@binders/ui-kit/lib/elements/icons/AngleDown/AngleDown";
import { FC } from "react";
import { TargetItem } from "../TargetItem/TargetItem";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import "./TargetList.styl";

export const TargetList: FC<{ targetUsers: User[] }> = (props) => {
    const listRef = React.useRef<HTMLDivElement>(null);
    const [isScrolledToBottom, setIsScrolledToBottom] = React.useState(false);

    // Sets isScrolledToBottom to false, only when there is scroll and the list is not scrolled to the bottom
    React.useEffect(() => {
        const el = listRef.current;
        if (el == null) return;
        const listener = () => {
            const hasScroll = el.scrollHeight > el.clientHeight;
            if (!hasScroll) return setIsScrolledToBottom(true);
            const scrolledToBottom = listRef.current.scrollTop > (listRef.current.scrollHeight - listRef.current.offsetHeight) - 10;
            if (scrolledToBottom !== isScrolledToBottom) {
                setIsScrolledToBottom(scrolledToBottom);
            }
        }
        // Run the listener once to set the initial state
        listener();
        el.addEventListener("scroll", listener);
        return () => el.removeEventListener("scroll", listener);
    }, [listRef, isScrolledToBottom, props.targetUsers]);

    return (
        <>
            <div className="targetList-list" ref={listRef}>
                {props.targetUsers.map((deviceTargetUser) => (
                    <TargetItem
                        deviceTargetUser={deviceTargetUser}
                        key={deviceTargetUser.id}
                    />
                ))}
            </div>
            {!isScrolledToBottom && (
                <div className="targetList-scrollIndicator">
                    <AngleDown />
                </div>
            )}
        </>
    )
}