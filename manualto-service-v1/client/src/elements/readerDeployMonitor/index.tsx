import * as React from "react";
import { DeployMonitor } from "@binders/ui-kit/lib/compounds/deployMonitor";
import "./monitor.styl";

const customClasses = [
    "deploy-monitor-reader"
];

const ReaderDeployMonitor: React.FC = (props) => {
    return (
        <DeployMonitor customClasses={customClasses}>
            {props.children}
        </DeployMonitor>
    )
}

export default ReaderDeployMonitor;