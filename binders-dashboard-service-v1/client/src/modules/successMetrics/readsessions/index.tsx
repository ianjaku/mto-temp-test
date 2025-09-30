import * as React from "react";
import { APIDocInfosCsv, APIReadSessionsCsv } from "../../../apiclient/tracking";
import { APISummarizeDraftsForAccountCsv, APISummarizePublicationsForAccountCsv } from "../../documents/api";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import Button from "@binders/ui-kit/lib/elements/button";
import { saveCsvToFile } from "@binders/client/lib/util/download";

export interface IReadSessionsProps {
    activeAccount?: Account;
}

export interface IReadSessionsState {
    loading: string[];
}

class ReadSessions extends React.Component<IReadSessionsProps, IReadSessionsState> {

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props) {
        super(props);
        this.state = {
            loading: [],
        };
    }

    private startLoading(key: string) {
        this.setState({ loading: [...this.state.loading, key] });
    }

    private stopLoading(key: string) {
        this.setState({ loading: this.state.loading.filter((l) => l !== key) });
    }

    private isLoading(key: string) {
        return this.state.loading.includes(key);
    }

    private async downloadReport(
        apiCall: () => Promise<string>,
        fileName: string,
        loadingKey: string,
    ) {
        await saveCsvToFile(
            apiCall,
            fileName,
            // eslint-disable-next-line no-console
            e => console.error(e),
            loadingState => {
                if (loadingState) {
                    this.startLoading(loadingKey);
                } else {
                    this.stopLoading(loadingKey);
                }
            }
        );
    }

    private async generateDocInfos() {
        await this.downloadReport(
            () => APIDocInfosCsv(this.props.activeAccount.id),
            `doc info for ${this.props.activeAccount.name} on manualto`,
            "doc-infos",
        );
    }

    private async dumpPublications() {
        await this.downloadReport(
            () => APISummarizePublicationsForAccountCsv(this.props.activeAccount.id),
            `publications for ${this.props.activeAccount.name} on manualto`,
            "publications",
        );
    }

    private async dumpDrafts() {
        await this.downloadReport(
            () => APISummarizeDraftsForAccountCsv(this.props.activeAccount.id),
            `drafts for ${this.props.activeAccount.name} on manualto`,
            "drafts",
        );
    }

    private async generateReadSessions() {
        await this.downloadReport(
            () => APIReadSessionsCsv(this.props.activeAccount.id),
            `readsessions for ${this.props.activeAccount.name} on manualto`,
            "read-sessions",
        );
    }

    public render(): JSX.Element {
        return (
            <div>
                <div className="account-metrics-section">
                    <Button
                        text="Generate read sessions report"
                        onClick={() => this.generateReadSessions()}
                        inactiveWithLoader={this.isLoading("read-sessions")}
                        secondary={true}
                    />
                    <p>Generate a list of all read sessions in csv format</p>
                </div>
                <div className="account-metrics-section">
                    <Button
                        text="Generate document info report"
                        onClick={() => this.generateDocInfos()}
                        inactiveWithLoader={this.isLoading("doc-infos")}
                        secondary={true}
                    />
                    <p>This csv lists a summary of all documents with their title (in master language), ID, published languages and composer link</p>
                </div>
                <div className="account-metrics-section">
                    <Button
                        text="Generate publication info report"
                        onClick={() => this.dumpPublications()}
                        inactiveWithLoader={this.isLoading("publications")}
                        secondary={true}
                    />
                    <p>This csv lists a summary of all document publications</p>
                </div>
                <div className="account-metrics-section">
                    <Button
                        text="Generate draft info report"
                        onClick={() => this.dumpDrafts()}
                        inactiveWithLoader={this.isLoading("drafts")}
                        secondary={true}
                    />
                    <p>This csv lists a summary of all document drafts</p>
                </div>
            </div>
        );
    }

}

export default ReadSessions;
