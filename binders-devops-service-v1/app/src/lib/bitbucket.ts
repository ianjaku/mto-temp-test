import { shortenBranchName } from "./k8s";

export const FIRST_PLAYWRIGHT_SLOT = 0;
export const TOTAL_PLAYWRIGHT_SLOTS = 5;

export const FIRST_INTEGRATION_SLOT = TOTAL_PLAYWRIGHT_SLOTS;
export const TOTAL_INTEGRATION_SLOTS = 4;

export const TOTAL_PARALLEL_TEST_SLOTS = TOTAL_PLAYWRIGHT_SLOTS + TOTAL_INTEGRATION_SLOTS;

/**
 * Should match the tag in <code>custom-images/Makefile</code>
 */
export const PLAYWRIGHT_AZ_VERSION_TAG = "1.53.1-jammy-multi-browser";

// List the branches that will always be deployed to staging from the pipeline
// This bypasses process.env.SKIP_STAGING_DEPLOY
export const STAGING_ALWAYS_DEPLOY_BRANCHES = [
    "develop"
].map(shortenBranchName);

export function isRunningPRPipeline(): boolean {
    // https://support.atlassian.com/bitbucket-cloud/docs/variables-and-secrets/
    // The pull request destination branch (used in combination with BITBUCKET_BRANCH).
    // Only available on a pull request triggered build.
    return process.env.BITBUCKET_PR_DESTINATION_BRANCH !== undefined;
}



