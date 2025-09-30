import * as React from "react";
import DropDown, { IDropdownElement } from "../../elements/dropdown";
import LineChart, { ILineChartDataItem, ILineChartDataSet } from "../../elements/linechart";
import { ChunkTimingsMap } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { formatTimeFromSeconds } from "../../helpers/helpers";
import vars from "../../variables";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./timeperchunk.styl";

export interface IPublicationLanguage {
    iso639_1: string;
    storyTitle: string;
}

export interface IPublicationTimingsSummary {
    id: string;
    created: Date;
    language: IPublicationLanguage;
    chunkTimingsMap: ChunkTimingsMap;
    isActive: boolean;
    views: number;
}
export interface ITimeSpentPerChunkStatProps {
    publicationTimingsSummaries: IPublicationTimingsSummary[];
    timeLineColor?: string;
    wordsLineColor?: string;
    title?: string;
    t: TFunction
}

export interface ITimeSpentPerChunkStatState {
    activePublicationTimingsSummary: IPublicationTimingsSummary;
}

class TimeSpentPerChunkStat extends React.Component<ITimeSpentPerChunkStatProps, ITimeSpentPerChunkStatState> {
    static defaultProps = {
        timeLineColor: "#154360",
        wordsLineColor: vars.accentColor,
    };
    private readonly sorted: IPublicationTimingsSummary[] = [];
    private readonly t: TFunction;

    constructor(props: ITimeSpentPerChunkStatProps) {
        super(props);
        this.t = props.t;
        this.setActivePublicationTimingsSummary = this.setActivePublicationTimingsSummary.bind(this);
        this.sorted = this.sortPublications(props.publicationTimingsSummaries);
        this.state = {
            activePublicationTimingsSummary: this.getActivePublicationTimingsSummary(),
        };
    }

    public render() {
        const ddElements = this.getPublicationTimingsSummaryDropdownElements();
        const { activePublicationTimingsSummary } = this.state;
        if (!activePublicationTimingsSummary) {
            return <div />;
        }
        return (
            <div className="timeperchunk-stat">
                <div className="stats-header">
                    <h2 className="stats-header-title">
                        {this.props.title}
                    </h2>
                    <div className={cx("timeperchunk-stat-header-ranges", "stats-header-ranges")}>
                        <label>{`${this.t(TranslationKeys.General_Publication)}:`}</label>
                        <DropDown
                            type="Publication"
                            elements={ddElements}
                            onSelectElement={this.setActivePublicationTimingsSummary}
                            selectedElementId={activePublicationTimingsSummary.id}
                            showBorders={false}
                        />
                    </div>
                </div>
                <div className="stats-body">
                    <LineChart
                        dataSets={[
                            this.buildWordCountDataSet(),
                            this.buildTimeDataSet(),
                        ]}
                        xAxisLabel={this.t(TranslationKeys.Edit_Chunk, { count: 1 })}
                        useMinimumYDomain={true}
                    />
                </div>
            </div>
        );
    }

    private getActivePublicationTimingsSummary(id?: string) {
        return id ?
            this.sorted.find(pub => pub.id === id) :
            (this.sorted.length > 0 && this.sorted[0]);
    }

    private buildTimeDataSet(): ILineChartDataSet {
        return {
            data: this.extractTimeData(),
            lineColor: this.props.timeLineColor,
            yAxisLabel: this.t(TranslationKeys.Analytics_AverageReadTime),
            yLabelTransform: formatTimeFromSeconds,
        };
    }

    private buildWordCountDataSet(): ILineChartDataSet {
        return {
            data: this.extractWordsData(),
            lineColor: this.props.wordsLineColor,
            renderAsBars: true,
            yAxisLabel: this.t(TranslationKeys.Analytics_WordsPerChunk),
        };
    }

    private sortPublications(publicationTimingsSummaries) {
        const [active, notActive] = publicationTimingsSummaries.reduce(([active, notActive], el) => {
            return el.isActive ? [[el, ...active], notActive] : [active, [el, ...notActive]];
        }, [[], []]);
        return active.sort((el1, el2) => el2.views - el1.views).concat(notActive);
    }

    private setActivePublicationTimingsSummary(id?: string) {
        const activePublicationTimingsSummary = this.getActivePublicationTimingsSummary(id);
        this.setState({
            activePublicationTimingsSummary,
        });
    }

    private extractTimeData(): ILineChartDataItem[] {
        const { activePublicationTimingsSummary } = this.state;
        return activePublicationTimingsSummary?.chunkTimingsMap &&
            Object.entries(activePublicationTimingsSummary.chunkTimingsMap).map(([chunkIndex, chunkTiming]) => ({
                x: `${(parseInt(chunkIndex) + 1)}`,
                y: Math.round(chunkTiming.timeSpentMs / 1000)
            }));
    }

    private extractWordsData(): ILineChartDataItem[] {
        const { activePublicationTimingsSummary } = this.state;
        return activePublicationTimingsSummary?.chunkTimingsMap &&
            Object.entries(activePublicationTimingsSummary.chunkTimingsMap).map(([chunkIndex, chunkTiming]) => ({
                label: this.t(TranslationKeys.Analytics_ChunkWordsAverageRead, {
                    chunkNumber: parseInt(chunkIndex) + 1,
                    count: chunkTiming.wordCount,
                    time: formatTimeFromSeconds(Math.round(chunkTiming.timeSpentMs / 1000), { verbose: true })
                }),
                x: `${parseInt(chunkIndex) + 1}`,
                y: chunkTiming.wordCount,
            }));
    }

    private getPublicationTimingsSummaryDropdownElements(): IDropdownElement[] {
        const { publicationTimingsSummaries } = this.props;
        const truncate = (str) => str.length > 32 ? `${str.substring(0, 32)}...` : str;
        const currentTitles = publicationTimingsSummaries.reduce((reduced, publication) => {
            const { language: { iso639_1: languageCode, storyTitle } } = publication;
            // they're sorted in descending order so first is latest
            if (!reduced[languageCode]) {
                reduced[languageCode] = storyTitle;
            }
            return reduced;
        }, {} as { [languageCode: string]: string });
        const treatedLanguageCodes = [];
        const titleDiffLanguageCodes = [];
        return this.sorted.map((publication) => {
            const showLanguageCode = Object.keys(currentTitles).length > 1;
            const { id, isActive, language: { storyTitle, iso639_1: languageCode }, created, views } = publication;
            const languageCodeStr = showLanguageCode ? `${languageCode} ` : "";
            const timestampStr = created.toISOString();
            const viewsStr = views && views > 0 ?
                ` (${views} ${this.t(TranslationKeys.Analytics_View, { count: views })})` :
                "";
            let titleStr = "";
            if (treatedLanguageCodes.indexOf(languageCode) === -1) {
                titleStr = ` ${truncate(storyTitle)}`;
            } else if (titleDiffLanguageCodes.indexOf(languageCode) > -1) {
                titleStr = ` ${truncate(storyTitle)}`;
            } else if (currentTitles[languageCode] !== storyTitle) {
                titleStr = ` ${truncate(storyTitle)}`;
                titleDiffLanguageCodes.push(languageCode);
            }
            treatedLanguageCodes.push(languageCode);
            return {
                id,
                isGrayedOut: !isActive,
                label: `${languageCodeStr}${timestampStr}${titleStr}${viewsStr}`,
            };
        });
    }
}

export default withTranslation()(TimeSpentPerChunkStat);
