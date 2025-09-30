import * as React from "react";
import {
    MOCK_FORCE_UPDATE_QUERY_VARIABLE,
    PollInterval,
    monitorBuildInfo,
    stopMonitor
} from "@binders/client/lib/deploys/monitor";
import Ribbon, { RibbonType } from "../../elements/ribbon";
import Button from "../../elements/button";
import { ShowRibbonFunction } from "../ribbons/RibbonsView";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import debounce from "lodash.debounce";
import { getQueryStringVariable } from "@binders/client/lib/util/uri";
import { useShowRibbon } from "../ribbons/hooks";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";
import { withTranslation } from "@binders/client/lib/react/i18n";

const DEPLOY_MONITOR_RIBBON_ID = "deploy-monitor-ribbon";

interface IDeployMonitorProps {
    ribbonType?: RibbonType;
    customClasses?: string | string[] | { [className: string]: boolean };
    showRibbon: ShowRibbonFunction;
}

interface IDeployMonitorState {
    intervalId: undefined | PollInterval;
}

const pageReload = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete(MOCK_FORCE_UPDATE_QUERY_VARIABLE);
    window.location.href = url.toString();
}

let reloadCheckerInterval = undefined;
let deadline;

function checkPageReload() {
    if (deadline && Date.now() > deadline) {
        pageReload();
    }
}


const reloadIntervalFromQuery = Number.parseInt(getQueryStringVariable(MOCK_FORCE_UPDATE_QUERY_VARIABLE), 10);
const reloadInterval = Number.isNaN(reloadIntervalFromQuery) ? 600_000 : reloadIntervalFromQuery;

const setReloadTimer = () => {
    if (!reloadCheckerInterval) {
        reloadCheckerInterval = setInterval(checkPageReload, 1_000);
        updateDeadline();
    }
}

const updateDeadline = () => {
    if (reloadCheckerInterval) {
        deadline = Date.now() + reloadInterval;
    }
}
const debouncedUpdateDeadline = debounce(updateDeadline, 1000, { leading: true, maxWait: 3000 });

class DeployMonitorClass extends React.Component<IDeployMonitorProps, IDeployMonitorState> {

    static defaultProps = {
        ribbonType: RibbonType.CUSTOM,
        customClasses: []
    }

    private t;

    constructor(props) {
        super(props);
        this.t = props.t;
        this.state = {
            intervalId: undefined
        };
    }

    componentDidMount() {
        const updateDetected = this.showRibbon.bind(this);
        const intervalId = monitorBuildInfo(updateDetected);
        this.setState({ intervalId });
    }

    componentWillUnmount() {
        if (this.state.intervalId) {
            stopMonitor(this.state.intervalId);
        }
    }

    showRibbon() {
        this.props.showRibbon(
            DEPLOY_MONITOR_RIBBON_ID,
            { position: "top", hideOnRouteChange: false, overwrite: false },
            () => (
                <Ribbon
                    type={this.props.ribbonType}
                    customClasses={this.props.customClasses}
                    closeable={false}
                >
                    <span>{this.t(TranslationKeys.General_NewReleaseReloadInfo)}</span>
                    <Button onClick={pageReload} text={this.t(TranslationKeys.General_Reload)} />
                </Ribbon>
            )
        );
        setReloadTimer();
    }

    render() {
        const { children } = this.props;
        const updateDeadlineProps = {
            onMouseMove: debouncedUpdateDeadline,
            onMouseDown: debouncedUpdateDeadline,
            onKeyDown: debouncedUpdateDeadline
        }
        return (
            <div {...updateDeadlineProps}>
                {children}
            </div>
        );
    }
}

const DeployMonitorWithHooks = withHooks(DeployMonitorClass, () => ({
    showRibbon: useShowRibbon()
}));
export const DeployMonitor = withTranslation()(DeployMonitorWithHooks);
