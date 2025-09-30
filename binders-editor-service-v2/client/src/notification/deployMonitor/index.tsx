import * as React from "react";
import { DeployMonitor } from "@binders/ui-kit/lib/compounds/deployMonitor";
import { RibbonType } from "@binders/ui-kit/lib/elements/ribbon";
import "./monitor.styl";

const customClasses = [
    "editor-deploy-monitor"
];

const EditorDeployMonitor: React.FC = (props) => {
    return (
        <DeployMonitor ribbonType={RibbonType.INFO} customClasses={customClasses}>
            {props.children}
        </DeployMonitor>
    )
}

export default EditorDeployMonitor;