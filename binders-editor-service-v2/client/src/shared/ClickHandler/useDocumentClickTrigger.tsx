import * as React from "react";
import { closestByClassName } from "../../documents/helper";
import { useClickHandlerContext } from "./ClickHandlerContext";

export default function useDocumentClickTrigger(
    exceptionClassNames: string[], // don't run callback when target or its parents are within these
    callback: () => void,
): void {
    const { lastClickedElement } = useClickHandlerContext();
    const exceptionClassNamesSerialized = React.useMemo(() => exceptionClassNames.join(), [exceptionClassNames]);
    React.useEffect(() => {
        if (!lastClickedElement) {
            return;
        }
        if (!closestByClassName(lastClickedElement, exceptionClassNames)) {
            callback();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [callback, exceptionClassNamesSerialized, lastClickedElement]);
}
