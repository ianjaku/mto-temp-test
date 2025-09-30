import * as React from "react";
import DropdownArrow from "@binders/ui-kit/lib/elements/icons/DropdownArrow";
import DropupArrow from "@binders/ui-kit/lib/elements/icons/DropupArrow";

const ArrowBtn = ({ isExpand }: { isExpand?: boolean }): React.ReactElement => {
    return (
        <label className="accessBox-searchBar-header-arrowBtn">
            {isExpand ? <DropdownArrow /> : <DropupArrow />}
        </label>
    );
}
export default ArrowBtn;