import * as React from "react";
import ThemedInput, { IInputProps } from "./index";
import SearchIcon from "../icons/Search";
import cx from "classnames";
import "./input.styl";

const SearchInput: React.FC<Omit<IInputProps, "ref">> = (props) => {
    return (
        <div className={cx("input-wrapper input-wrapper-search", { "input-wrapper--inverted": props.inverted })}>
            <span className="input-icon input-icon--center">
                <SearchIcon />
            </span>
            <ThemedInput {...props} type="text" />
        </div>
    );
}

export default SearchInput;
