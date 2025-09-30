import * as React from "react";
import { Activities } from "./Activities";
import Layout from "../shared/Layout/Layout";
import { RouteComponentProps } from "react-router";
import { browseInfoFromRouteParams } from "./routes";
import "./HomePage.styl";

type HomePageProps = RouteComponentProps<{
    searchTerm?: string
    collectionId?: string
    scopeCollectionId?: string
}>;

export const HomePage: React.FC<HomePageProps> = (props) => {
    const modalPlaceholder = React.useRef<HTMLDivElement>();

    return (
        <div className="home-page">
            <Layout
                breadcrumbsClassName="container"
                browseInfoFromRouteParams={browseInfoFromRouteParams}
                className="homePage"
                containerClassName="container"
                hideBreadcrumbs={true}
                history={props.history}
                innerContainerClassName="container-inner"
                match={props.match}
                location={props.location}
                modalPlaceholder={modalPlaceholder.current}
                showMyLibraryLink={false}
            >
                <Activities />
            </Layout>
        </div>
    );
}
