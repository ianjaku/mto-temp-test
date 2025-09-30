import * as React from "react";
import {
    APIDeleteDeploy,
    APIGetAllLaunchDarklyFlags,
    APILoadDeployments,
    APIRunDeploy,
    APIRunGroupDeploy
} from "../../apiclient/devops";
import { Deployment, IServiceSpec, ServiceDeployment } from "@binders/client/lib/clients/devopsservice/v1/contract";
import { SortOrder, fmtDateIso8601TZ, sortByDate } from "@binders/client/lib/util/date";
import { Accordion } from "@binders/ui-kit/lib/elements/accordion";
import Button from "@binders/ui-kit/lib/elements/button";
import Checkbox from "@binders/ui-kit/lib/elements/checkbox";
import Loader from "@binders/ui-kit/lib/elements/loader";
import Table from "@binders/ui-kit/lib/elements/Table/SimpleTable";
import { isBefore } from "date-fns";
import "./deploys.styl";

type FlagState = { [key: string]: unknown };

type DeploymentCandidate = {
    spec: IServiceSpec;
    deployment: Deployment;
};

interface DeploysState {
    deploys: ServiceDeployment[];
    openItems: string[];
    isDeploying: boolean;
    ldFlags: FlagState,
    /** See {@link isPartialDeployment} to understanding what is a partial deployment */
    excludePartialDeployments: boolean;
}

class Deploys extends React.Component<unknown, DeploysState> {
    constructor(props: unknown) {
        super(props);
        this.state = {
            deploys: undefined,
            openItems: [],
            isDeploying: false,
            ldFlags: undefined,
            excludePartialDeployments: true,
        };
        this.onUpgradeAll = this.onUpgradeAll.bind(this);
    }

    private async loadComponents() {
        const deploys = await APILoadDeployments();
        const ldFlags = await APIGetAllLaunchDarklyFlags()
        this.setState({ deploys, ldFlags });
    }

    componentDidMount(): void {
        this.loadComponents();
    }

    render(): JSX.Element {
        const { deploys, ldFlags } = this.state;
        return (
            <div className="deploys-layout">
                {!deploys ?
                    <Loader text="Fetching deploy info" /> :
                    this.renderDeploys(deploys)
                }
                {ldFlags && this.renderFlags(ldFlags)}
            </div>
        );
    }

    private async onUpgradeAll() {
        const items = this.state.deploys
            .filter(serviceDeployment => this.isOutdated(serviceDeployment))
            .map((serviceDeployment): DeploymentCandidate => ({
                spec: serviceDeployment.spec,
                deployment: this.getMostRecentCandidate(serviceDeployment)
            }));
        await this.doGroupDeploy(items);
    }

    private getMostRecentCandidate(serviceDeployment: ServiceDeployment): Deployment {
        const candidates = serviceDeployment.candidates
            .filter(candidate => !this.shouldExcludeDeployment(candidate));
        return sortByDate(candidates, candidate => new Date(candidate.deployDate), SortOrder.DESC)
            .shift();
    }

    private renderSummary(deploys: ServiceDeployment[]) {
        const { isDeploying, excludePartialDeployments } = this.state;
        const outdatedDeploysCount = deploys
            .filter(serviceDeployment => this.isOutdated(serviceDeployment))
            .length;
        return (
            <div className="deploys-summary">
                <div className="deploys-summary-message">
                    {outdatedDeploysCount === 0 ?
                        <span>All services up to date</span> :
                        <>
                            {`${outdatedDeploysCount} out of ${deploys.length} services are outdated`}
                            <Button text="Upgrade All" isEnabled={!isDeploying} onClick={this.onUpgradeAll} />
                        </>
                    }
                </div>
                <div className="deploys-config">
                    <Checkbox
                        label="Hide partial deployments"
                        checked={excludePartialDeployments}
                        onCheck={() => this.setState({ excludePartialDeployments: !excludePartialDeployments } )}
                        iconStyle={{ marginTop: 0, paddingTop: 0 }}
                        labelStyle={{ marginTop: 0, paddingTop: 0 }}
                        style={{ marginTop: 0, paddingTop: 0 }}
                    />
                </div>
            </div>
        );
    }

    private renderDeploys(deploys: ServiceDeployment[]) {
        return (
            <div>
                {this.renderSummary(deploys)}
                {deploys.map(serviceDeployment => this.renderDeploy(serviceDeployment))}
            </div>
        );
    }

    private renderFlags(ldFlags: FlagState) {
        return (
            <div>
                <div className="deploys-summary">
                    Launch Darkly flags state
                </div>
                <div className="flags">
                    {Object.entries(ldFlags).map(([key, value]) => (
                        <div key={key} className="flags-item">
                            <strong className="flags-key">{key}:</strong>
                            <span className="flags-value">{value.toString()}</span>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    private isOutdated(serviceDeployment: ServiceDeployment) {
        if (!serviceDeployment.activeDeployment) {
            return true;
        }
        const activeDeployment = findActiveDeployment(serviceDeployment);
        const hasNewerCandidatesThanActive = serviceDeployment.candidates
            .filter(candidate => !this.shouldExcludeDeployment(candidate))
            .some(candidate => isDeploymentBefore(activeDeployment, candidate));
        return !activeDeployment || hasNewerCandidatesThanActive;
    }

    private renderDeployStatus(deploy: ServiceDeployment) {
        if (!deploy.activeDeployment) {
            return <span className="deploys-service-inactive">Inactive</span>;
        }
        if (deploy.candidates.length === 0) {
            return <span className="deploys-service-no-candidates">No candidates</span>;
        }
        if (this.isOutdated(deploy)) {
            return <span className="deploys-service-out-of-date">Out of date</span>;
        }
        return <span className="deploys-service-up-to-date">Up to date</span>;
    }

    private renderDeployHeader(serviceId: string, serviceDeployment: ServiceDeployment) {
        const activeDeploy = findActiveDeployment(serviceDeployment);
        const deployStatus = this.renderDeployStatus(serviceDeployment);
        const tail = activeDeploy?.deployDate ?
            ` (${fmtDateIso8601TZ(new Date(activeDeploy.deployDate))})` :
            "";
        return (
            <div>
                <span>{serviceId}</span> - {deployStatus}{tail}
            </div>
        );
    }

    private onToggle = (serviceKey: string) => {
        const { openItems } = this.state;
        const newOpenItems = openItems.includes(serviceKey) ?
            openItems.filter(k => k !== serviceKey) :
            [...openItems, serviceKey];
        this.setState({
            openItems: newOpenItems
        });
    }

    private getServiceId(deploy: ServiceDeployment) {
        return `${deploy.spec.name} ${deploy.spec.version}`;
    }

    private renderDeploy(serviceDeployment: ServiceDeployment) {
        const serviceId = this.getServiceId(serviceDeployment);
        const deployHeader = this.renderDeployHeader(serviceId, serviceDeployment);
        const isOpened = this.state.openItems.includes(serviceId);
        const onToggle = this.onToggle.bind(this, serviceId);
        return (
            <Accordion key={serviceId} header={deployHeader} isOpened={isOpened} onToggle={onToggle}>
                {this.renderDeployCandidates(serviceDeployment)}
            </Accordion>
        );
    }

    private renderDeployCandidates(serviceDeployment: ServiceDeployment) {
        const { spec, candidates } = serviceDeployment;
        const activeDeployment = findActiveDeployment(serviceDeployment);
        const data = candidates
            .filter(candidate => !this.shouldExcludeDeployment(candidate))
            .map(candidate => [
                candidate.branch,
                this.renderCommitRef(candidate, activeDeployment),
                candidate.deployDate,
                `${candidate.availableReplicas}/${candidate.expectedReplicas}`,
                this.getCandidateRowActions(spec, candidate, activeDeployment)
            ] as const);
        return (
            <div className="deploys-candidates">
                <Table
                    customHeaders={[ "branch", "commitRef", "deployDate", "pods", "actions" ]}
                    data={data}
                />
            </div>
        );
    }

    private renderCommitRef(deploy: Deployment, activeDeploy: Deployment) {
        const deployTag = `${deploy.branch}-${deploy.commitRef}`;
        const activeTag = activeDeploy && `${activeDeploy.branch}-${activeDeploy.commitRef}`;
        const urlPrefix = "https://bitbucket.org/bindersmedia/manualto";
        const link = (!activeTag || activeTag === deployTag) ?
            `${urlPrefix}/commits/${deployTag}` :
            `${urlPrefix}/branches/compare/${deployTag}..${activeTag}`;
        return (
            <div>
                <a href={link} target="_blank" rel="noopener noreferrer">{deployTag}</a>
            </div>
        );
    }

    private async doGroupDeploy(items: DeploymentCandidate[]) {
        this.setState({ isDeploying: true });
        await APIRunGroupDeploy(items);
        await this.loadComponents();
        this.setState({ isDeploying: false });
    }

    private async doDeploy(spec: IServiceSpec, deploy: Deployment) {
        this.setState({ isDeploying: true });
        await APIRunDeploy(spec, deploy);
        await this.loadComponents();
        this.setState({ isDeploying: false });
    }

    private async deleteDeploy(spec: IServiceSpec, deploy: Deployment) {
        await APIDeleteDeploy(spec, deploy);
        await this.loadComponents();
    }

    private async doDeploymentGroupRollback(deploy: Deployment) {
        const { deploymentGroup } = deploy;
        if (!deploymentGroup) {
            // eslint-disable-next-line no-console
            console.error("Cannot do group rollback, no group found", deploy);
        }
        const { deploys } = this.state;
        const toRollback = deploys.flatMap(serviceDeployment =>
            serviceDeployment.candidates
                .filter(candidate => candidate.deploymentGroup === deploymentGroup)
                .map((candidate): DeploymentCandidate => ({
                    spec: serviceDeployment.spec,
                    deployment: candidate
                }))
        );
        const deploymentsWithPartialDeployments = toRollback.filter(({ deployment }) => this.shouldExcludeDeployment(deployment));
        if (deploymentsWithPartialDeployments.length > 0) {
            const serviceNames = deploymentsWithPartialDeployments.map(({ spec }) => spec.name);
            alert(`Cannot do group rollback, following services are missing pods: ${serviceNames.join(", ")}`);
        } else {
            await this.doGroupDeploy(toRollback);
        }
    }

    private getCandidateRowActions(spec: IServiceSpec, candidateDeployment: Deployment, activeDeployment: Deployment) {
        const { isDeploying } = this.state;

        const toButton = (key: string, text: string, isEnabled: boolean, onClick: () => void) => (
            <Button key={key} text={text} isEnabled={!isDeploying && isEnabled} onClick={onClick} />
        );

        const doDeploy = this.doDeploy.bind(this, spec, candidateDeployment);
        const doRollback = this.doDeploymentGroupRollback.bind(this, candidateDeployment);
        const deleteDeploy = this.deleteDeploy.bind(this, spec, candidateDeployment)
        if (!activeDeployment) {
            return [
                toButton("deploy", "Deploy", true, doDeploy)
            ];
        }
        if (isDeploymentBefore(candidateDeployment, activeDeployment)) {
            const buttons = [
                toButton("rollback", "Rollback", true, doDeploy),
            ];
            if (candidateDeployment.deploymentGroup) {
                buttons.push(toButton("rollback-group", "Rollback Group", true, doRollback));
            }
            buttons.push(toButton("delete", "Delete Deployment", true, deleteDeploy));
            return buttons;
        }
        if (isDeploymentBefore(activeDeployment, candidateDeployment)) {
            return [
                toButton("upgrade", "Upgrade", true, doDeploy),
                toButton("delete", "Delete Deployment", true, deleteDeploy)
            ];
        }
        return [];
    }

    private shouldExcludeDeployment(deployment: Deployment): boolean {
        return this.state.excludePartialDeployments && isPartialDeployment(deployment);
    }
}

const findActiveDeployment = (serviceDeployment: ServiceDeployment): Deployment | undefined => {
    if (!serviceDeployment.activeDeployment) {
        return undefined;
    }
    return serviceDeployment.candidates.find(candidate => (
        candidate.commitRef === serviceDeployment.activeDeployment.commitRef &&
        candidate.branch === serviceDeployment.activeDeployment.branch
    ));
};

/**
 * Evaluates whether the first deployment happened before the second one
 */
const isDeploymentBefore = (deployment: Deployment, otherDeployment: Deployment): boolean =>
    isBefore(new Date(deployment.deployDate), new Date(otherDeployment.deployDate));

/**
 * We consider a deployment partial when the available number of replicas does not match the expected one
 */
const isPartialDeployment = (deployment: Deployment): boolean =>
    deployment.expectedReplicas !== deployment.availableReplicas;

export default Deploys;