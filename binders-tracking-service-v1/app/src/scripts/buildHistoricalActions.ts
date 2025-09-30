/* eslint-disable quotes */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import {
    ElasticUserActionsRepository,
    UserActionsFilter
} from "../trackingservice/repositories/userActionsRepository";
import { readFileSync, writeFileSync } from "fs";
import { BackendUserServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { UserActionType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { parseISO } from "date-fns";

interface InputData {
    [groupId: string]: {
        [timerangeLabel: string]: string[]
    }
}

interface OutputData {
    [groupName: string]: {
        [timerangeLabel: string]: number
    }
}

const getOptions = () => {
    const inputFilePath = process.argv[2]
    const accountId = process.argv[3]
    const userActionTypeStr = process.argv[4]

    if (!inputFilePath) {
        console.error("Please provide an input file path as the first argument")
        process.exit(1)
    }
    if (!accountId) {
        console.error("Please provide an accountId as the second argument")
        process.exit(1)
    }
    if (!userActionTypeStr) {
        console.error("Please provide a UserActionType as the third argument (e.g., \"DOCUMENT_READ\")")
        process.exit(1)
    }

    // Validate the UserActionType
    const userActionType = UserActionType[userActionTypeStr as keyof typeof UserActionType]
    if (userActionType === undefined) {
        console.error(`Invalid UserActionType: ${userActionTypeStr}`)
        console.error(`Valid types are: ${Object.keys(UserActionType).filter(k => isNaN(Number(k))).join(", ")}`)
        process.exit(1)
    }

    return {
        inputFilePath,
        accountId,
        userActionType
    }
}

const parseTimeRange = (timerangeLabel: string): { startDate: Date, endDate: Date } => {
    const [startStr, endStr] = timerangeLabel.split("_")
    const startDate = parseISO(startStr)
    const endDate = parseISO(endStr)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error(`Invalid time range label: ${timerangeLabel}`)
    }

    // Set end date to end of day
    endDate.setHours(23, 59, 59, 999)

    return { startDate, endDate }
}

const getDeps = async () => {
    const config = BindersConfig.get()
    const logger = LoggerBuilder.fromConfig(config)
    const userActionsRepo = new ElasticUserActionsRepository(config, logger)
    const userServiceClient = await BackendUserServiceClient.fromConfig(config, "build-historical-actions")

    return {
        userActionsRepo,
        userServiceClient,
        logger,
        config
    }
}

async function countUserActions(
    userActionsRepo: ElasticUserActionsRepository,
    accountId: string,
    userIds: string[],
    userActionType: UserActionType,
    startDate: Date,
    endDate: Date
): Promise<number> {
    if (userIds.length === 0) {
        return 0
    }

    const filter: UserActionsFilter = {
        accountId,
        userIds,
        userActionTypes: [userActionType],
        startRange: {
            rangeStart: startDate,
            rangeEnd: endDate
        }
    }

    return await userActionsRepo.countUserActions(filter)
}

(async function () {
    const { inputFilePath, accountId, userActionType } = getOptions()
    const { userActionsRepo, userServiceClient } = await getDeps()

    const actionTypeName = UserActionType[userActionType]
    console.log(`Processing historical actions for account ${accountId}`)
    console.log(`Counting actions of type: ${actionTypeName}`)
    console.log(`Reading input from: ${inputFilePath}`)

    // Fetch all groups to create ID to name mapping
    console.log("\nFetching user groups for name mapping...")
    const groups = await userServiceClient.getGroups(accountId)
    const groupIdToName: { [id: string]: string } = {}
    for (const group of groups) {
        groupIdToName[group.id] = group.name
    }

    // Read and parse input file
    const inputData: InputData = JSON.parse(readFileSync(inputFilePath, "utf-8"))
    const outputData: OutputData = {}

    const groupIds = Object.keys(inputData)
    console.log(`Found ${groupIds.length} groups to process`)

    for (const groupId of groupIds) {
        const groupName = groupIdToName[groupId] || groupId // Fallback to ID if name not found
        console.log(`\nProcessing group: ${groupName} (${groupId})`)
        outputData[groupName] = {}

        const timeRanges = Object.keys(inputData[groupId])

        for (const timerangeLabel of timeRanges) {
            const userIds = inputData[groupId][timerangeLabel]

            if (userIds.length === 0) {
                console.log(`  ${timerangeLabel}: No users, count = 0`)
                outputData[groupName][timerangeLabel] = 0
                continue
            }

            try {
                const { startDate, endDate } = parseTimeRange(timerangeLabel)

                console.log(`  ${timerangeLabel}: Counting ${actionTypeName} actions for ${userIds.length} users`)

                const count = await countUserActions(
                    userActionsRepo,
                    accountId,
                    userIds,
                    userActionType,
                    startDate,
                    endDate
                )

                outputData[groupName][timerangeLabel] = count
                console.log(`    Found ${count} actions`)
            } catch (error) {
                console.error(`  Error processing ${timerangeLabel}: ${error.message}`)
                outputData[groupName][timerangeLabel] = 0
            }
        }
    }

    // Save output
    const outputPath = `/tmp/historical_actions_${accountId}_${Date.now()}.json`
    writeFileSync(outputPath, JSON.stringify(outputData, null, 2))

    console.log("\n✅ Processing complete")
    console.log(`Results saved to: ${outputPath}`)

    // Print summary
    let totalGroups = 0
    let totalTimeRanges = 0
    let totalActions = 0

    for (const groupName of Object.keys(outputData)) {
        totalGroups++
        for (const timerange of Object.keys(outputData[groupName])) {
            totalTimeRanges++
            totalActions += outputData[groupName][timerange]
        }
    }

    console.log(`\nSummary:`)
    console.log(`  Groups processed: ${totalGroups}`)
    console.log(`  Time ranges processed: ${totalTimeRanges}`)
    console.log(`  Total ${actionTypeName} actions counted: ${totalActions}`)

    process.exit(0)
})().catch(error => {
    console.error("Fatal error:", error)
    process.exit(1)
})