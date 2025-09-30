import * as https from "https";
import {
    createGauge,
    getMetricName
} from  "@binders/binders-service-common/lib/monitoring/prometheus";
import { Logger } from "@binders/binders-service-common/lib/util/logging";

const CHECK_CORP_SITE_INTERVAL = 60 * 1000;
const CORP_SITE_MAIN = "https://manual.to";

function setupCorpSiteMonitor(logger: Logger): void {
    const logCategory = "corp-site-monitor";
    const gaugeName = getMetricName(logCategory);
    const prometheusGauge = createGauge(gaugeName, "Check if the corp site is up and running", []);
    prometheusGauge.set(1);
    const siteUp = () => {
        logger.info("Corp site up and running", logCategory);
        prometheusGauge.set(1);
    }
    const siteDown = (msg: string) => {
        prometheusGauge.set(0);
        logger.error(msg, logCategory);
    }
    const checkCorpsite = async () => {
        const req = https.get(CORP_SITE_MAIN, (res) => {
            if (res.statusCode !== 200) {
                siteDown(`Wrong status code when checking corp site ${res.statusCode}`);
            } else {
                siteUp();
            }
            res.on("error", (err) => siteDown(`Error while checking corp site: ${err.message}`));
        })
        req.on("error", (err) => siteDown(`Error while checking corp site: ${err.message}`));
    }
    setInterval(checkCorpsite, CHECK_CORP_SITE_INTERVAL)
}

export default setupCorpSiteMonitor;