import { printImportNodes, sortImports, splitImports } from "./tsImports";
import * as ts from "typescript";
import { splitFile } from "./tsFile";

const failingImport = `import * as fs from "fs";
import * as HTTPStatusCode from "http-status-codes";
import * as moment from "moment";
import * as url from "url";`;

const failingImport4 = `import { BackendRoutingServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { Font, RoutingServiceContract } from "@binders/client/lib/clients/routingservice/v1/contract";
import { Something } from "@binders/client/src/clients/routingservice/v1/contract2";
import { getTmpPath } from "../storage/contract";
import { AzureFontStorage } from "./../storage/fonts";
import * as fs from "fs";
import { tmpdir } from "os";
import * as path from "path";
import * as AdmZip from "adm-zip";
`;

const failingImport3 = `/* eslint-disable no-console */
import tunnels, { ITunnelSpec as ITunnel, withTunnel } from "../k8s/tunnels";
import { buildBindersDevConfig, buildBindersProductionConfig, buildBindersStagingConfig,
    getESProductionBackupRepository, getElasticProductionConfig,
    getElasticProductionPodNames } from "../../lib/bindersconfig";
import { getClient, getLocalClient } from "./config";
import { isProduction, isStaging } from "../../lib/environment";
import { Client as ElasticClient } from "elasticsearch";
import { listPods } from "../k8s/pods";
import log from "../../lib/logging";
// Some nice export
export interface ISnapshotOptions {
    waitForCompletion: boolean;
}`;

const failingImport2 = `
import some, { other1, other2 } from "different";
import c from "c";
import * as React from "react";
import "fake.styl";
import { b } from "b";
import { a1, a2 } from "a";
`;

const failingImport1 = `import * as React from "react";
import * as ReactDOM from "react-dom";
import * as moment from "moment";
import { APIAddItemToCollection as APIAdd, APISaveNewBinder } from "../../documents/api";
import { BROWSE_ROUTE, browseInfoFromRouteParams } from "./routes";
import DebugLog, { ACL_LOADING_TICKET } from "@binders/client/lib/util/debugLogging";
import DocumentStore, { KEY_EDITABLE_DOCUMENTS_PREVIEWS } from "../../documents/store";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import { FEATURE_CHECKLISTS, FEATURE_DISABLE_PUBLIC_ICON, FEATURE_READONLY_EDITOR } from "@binders/client/lib/clients/accountservice/v1/contract";
import { ItemKind, trackItemCreated } from "../../tracking/actions";
import LibraryItem, { ItemType } from "@binders/ui-kit/lib/elements/libraryItem/row";
import Tooltip, { TooltipPosition, hideTooltip, showTooltip } from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import { WebData, WebDataState } from "@binders/client/lib/webdata";
import {
    checkHasFullPermissionInCurrentCollection,
    filterPermissionsWithRestrictions,
} from "../../authorization/tsHelpers";
import { extractTitleForBreadcrumb, makeItemsParentMap, renderItemContextMenu } from "../helper";
import { identity, intersection } from "ramda";
import {
    loadAdditionalInfoForCollections,
    loadBindersAdditionalInfo,
    loadBrowseContext,
    loadChecklistProgresses,
    loadCollectionsAdditionalInfo,
    setTestMode,
} from "../../browsing/actions";
import AccountStore from "../../accounts/store";
import AddNewDocument from "./document/AddNewDocument";
import AuthorizationStore from "../../authorization/store";
import Breadcrumbs from "@binders/ui-kit/lib/elements/breadcrumbs"
import BrowseStore from "../../browsing/store";
import Button from "@binders/ui-kit/lib/elements/button";
import { Container } from "flux/utils";
import ContextMenu from "@binders/ui-kit/lib/elements/contextmenu";
import CreateCollectionIcon from "@binders/ui-kit/lib/elements/icons/CreateCollection";
import CreateDocumentIcon from "@binders/ui-kit/lib/elements/icons/CreateDocument";
import EditLockingStore from "../../editlocking/store";
import FallbackComponent from "../../application/FallbackComponent";
import { FlashMessages } from "../../logging/FlashMessages";
import Layout from "../../shared/Layout";
import { Map } from "immutable";
import MenuItem from "@binders/ui-kit/lib/elements/contextmenu/MenuItem";
import { MyLibraryTabInfo } from "../MyLibraryTabInfo/MyLibraryTabInfo";
import NewCollectionForm from "./collection/form/index";
import { PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import SearchBar from "@binders/ui-kit/lib/elements/searchBar"
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import UserStore from "../../users/store";
import { WebDataComponent } from "@binders/ui-kit/lib/elements/webdata";
import autobind from "class-autobind";
import classNames from "classnames";
import { cleanESQuery } from "@binders/client/lib/util/elastic";
import { createCommonHitMap } from "@binders/client/lib/ancestors";
import { dispatch } from "@binders/client/lib/react/flux/dispatcher";
import { extractTitle } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { getItemIdsFromPermissionMap } from "../../authorization/helper";
import { getQueryStringVariable } from "@binders/client/lib/util/uri";
import i18next from "@binders/client/lib/react/i18n";
import { isThisItemHidden } from "../../shared/helper";
import { pickFirstParentItem } from "../../documents/helper";
import { withTranslation } from "@binders/client/lib/react/i18n";
import { moveItemInCollection } from "../../documents/actions";
import "./myLibrary.styl";
`;

// const imports = [
//     "import \"test.styl\"",
//     "import \"test.styl\";",
//     "import {\n" +
//         "    prop1, \n" +
//         "    prop2 \n" +
//         "    prop3, \n" +
//         "    prop4 \n" +
//         "} from \"react\""

// ];


const { commentHeaders, rest, lineCount } = splitFile(failingImport);
const { imports, rest: nonImports, srcFile, lastImportPosition } = splitImports(rest);
sortImports(imports, ["all", "multiple", "single", "none"]);
const printOptions = {
    multiLineEnabled: true,
    maxCharsPerLine: 100,
    quoteSymbol: "\"",
    fixSrcImports: true,
};
const output = `${commentHeaders}\n${printImportNodes(imports, srcFile, printOptions)}\n${rest.substr(lastImportPosition)}\n`;
console.log(output);
// const printer =  ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
// for (const imp of imports) {
//     console.log(printer.printNode(ts.EmitHint.Unspecified, imp, srcFile));
// }
