import * as React from "react";
import classNames from "classnames";
import "./toggle.styl";

export interface IToggleProps {
    isToggled?: boolean;
    onToggle: () => void;
    alwaysActive?: boolean;
    isEnabled?: boolean;
    className?: string;
    testId?: string;
}

const Toggle: React.FC<IToggleProps> = ({ isToggled, onToggle, alwaysActive, isEnabled = true, className, testId }) => (
    <div
        className={getClasses(isToggled, alwaysActive, isEnabled, className)}
        onClick={isEnabled ? onToggle : () => undefined}
        onDrag={isEnabled ? onToggle : () => undefined}
        onDoubleClick={isEnabled ? onToggle : undefined}
        data-testid={testId}
    >
        <div className="toggle-caret" />
    </div>
);

function getClasses(isToggled, alwaysActive, isEnabled, className): string {
    return classNames(
        "toggle-button",
        { "toggle-button--is-toggled": isToggled },
        { "toggle-button--always-active": alwaysActive },
        { "toggle-button--is-disabled": !isEnabled },
        className
    );
}

export default Toggle;
