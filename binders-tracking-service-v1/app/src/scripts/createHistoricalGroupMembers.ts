/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import {
    AuditLogRepositoryFactory,
    MongoAuditLogRepository
} from "../trackingservice/repositories/auditLogRepository";
import {
    AuditLogType,
    IUserGroupAuditLogData,
    UserGroupActionType
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { addMonths, endOfMonth, format, isAfter, parseISO, startOfMonth } from "date-fns";
import {
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { writeFileSync } from "fs";

interface HistoricalGroupMembers {
    [groupId: string]: {
        [timerangeLabel: string]: string[]
    }
}

interface GroupMemberChange {
    timestamp: Date
    action: UserGroupActionType
    userId: string
    groupId: string
}

const getOptions = () => {
    const accountId = process.argv[2]
    const startDateStr = process.argv[3]
    const endDateStr = process.argv[4]

    if (!accountId) {
        console.error("Please provide an accountId as the first argument")
        process.exit(1)
    }
    if (!startDateStr) {
        console.error("Please provide a start date (YYYY-MM-DD) as the second argument")
        process.exit(1)
    }
    if (!endDateStr) {
        console.error("Please provide an end date (YYYY-MM-DD) as the third argument")
        process.exit(1)
    }

    const startDate = parseISO(startDateStr)
    const endDate = parseISO(endDateStr)

    if (isNaN(startDate.getTime())) {
        console.error(`Invalid start date: ${startDateStr}`)
        process.exit(1)
    }
    if (isNaN(endDate.getTime())) {
        console.error(`Invalid end date: ${endDateStr}`)
        process.exit(1)
    }

    return {
        accountId,
        startDate,
        endDate
    }
}

const getDeps = async () => {
    const config = BindersConfig.get()
    const logger = LoggerBuilder.fromConfig(config)
    const userServiceClient = await BackendUserServiceClient.fromConfig(config, "create-historical-group-members")
    const repoFactory = await AuditLogRepositoryFactory.fromConfig(config, logger)
    const auditLogRepo = repoFactory.build(logger)

    return {
        userServiceClient,
        auditLogRepo,
        logger,
        config
    }
}

async function fetchAllGroupMemberChanges(
    auditLogRepo: MongoAuditLogRepository,
    accountId: string,
    startDate: Date,
    endDate: Date
): Promise<Map<string, GroupMemberChange[]>> {
    const changesByGroup = new Map<string, GroupMemberChange[]>()

    await auditLogRepo.batchProcessLogs({
        accountId,
        type: AuditLogType.USER_GROUP_UPDATE,
        startDate,
        endDate
    }, async (batch) => {
        batch.forEach(auditLog => {
            const data = auditLog.data as IUserGroupAuditLogData

            // Only interested in member additions and removals
            if (data.userGroupAction === UserGroupActionType.USER_GROUP_MEMBER_ADDED ||
                data.userGroupAction === UserGroupActionType.USER_GROUP_MEMBER_REMOVED) {

                if (data.userId && data.userGroupId) {
                    const change: GroupMemberChange = {
                        timestamp: new Date(auditLog.timestamp),
                        action: data.userGroupAction,
                        userId: data.userId,
                        groupId: data.userGroupId
                    }

                    if (!changesByGroup.has(data.userGroupId)) {
                        changesByGroup.set(data.userGroupId, [])
                    }
                    changesByGroup.get(data.userGroupId)!.push(change)
                }
            }
        })
    })

    // Sort changes by timestamp for each group
    for (const changes of changesByGroup.values()) {
        changes.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    }

    return changesByGroup
}

async function getCurrentGroupMembers(
    userServiceClient: any,
    accountId: string,
    groupId: string
): Promise<string[]> {
    try {
        const groupDetailsArray = await userServiceClient.multiGetGroupMembers(accountId, [groupId])
        if (groupDetailsArray.length > 0) {
            return groupDetailsArray[0].members.map((member: any) => member.id)
        }
        return []
    } catch (error) {
        console.warn(`Could not fetch current group members, assuming empty group: ${error.message}`)
        return []
    }
}

function reconstructMembersAtDate(
    currentMembers: string[],
    changes: GroupMemberChange[],
    targetDate: Date
): string[] {
    // Start with current members
    const members = new Set(currentMembers)

    // Work backwards from now to target date, reversing the changes
    const futureChanges = changes.filter(change => isAfter(change.timestamp, targetDate))

    // Reverse the changes that happened after our target date
    for (const change of futureChanges.reverse()) {
        if (change.action === UserGroupActionType.USER_GROUP_MEMBER_ADDED) {
            // If they were added after target date, remove them
            members.delete(change.userId)
        } else if (change.action === UserGroupActionType.USER_GROUP_MEMBER_REMOVED) {
            // If they were removed after target date, add them back
            members.add(change.userId)
        }
    }

    return Array.from(members)
}

function buildHistoricalMembershipForGroup(
    currentMembers: string[],
    changes: GroupMemberChange[],
    startDate: Date,
    endDate: Date
): { [timerangeLabel: string]: string[] } {
    const result: { [timerangeLabel: string]: string[] } = {}

    let currentMonth = startOfMonth(startDate)
    const finalMonth = startOfMonth(endDate)

    while (!isAfter(currentMonth, finalMonth)) {
        const monthStart = currentMonth
        const monthEnd = endOfMonth(currentMonth)

        // Get members at the end of this month
        const membersAtMonthEnd = reconstructMembersAtDate(
            currentMembers,
            changes,
            monthEnd
        )

        // Create the label for this time range
        const label = `${format(monthStart, "yyyy-MM-dd")}_${format(monthEnd, "yyyy-MM-dd")}`
        result[label] = membersAtMonthEnd.sort()

        // Move to next month
        currentMonth = addMonths(currentMonth, 1)
    }

    return result
}

(async function () {
    const { accountId, startDate, endDate } = getOptions()
    const { userServiceClient, auditLogRepo } = await getDeps()

    console.log(`Fetching historical group members for all groups in account ${accountId}`)
    console.log(`Time range: ${format(startDate, "yyyy-MM-dd")} to ${format(endDate, "yyyy-MM-dd")}`)

    // Get all groups in the account
    const groups = await userServiceClient.getGroups(accountId)
    console.log(`Found ${groups.length} groups in account`)

    // Fetch all member changes from audit logs for all groups
    const changesByGroup = await fetchAllGroupMemberChanges(
        auditLogRepo,
        accountId,
        startDate,
        endDate
    )

    let totalChanges = 0
    for (const changes of changesByGroup.values()) {
        totalChanges += changes.length
    }
    console.log(`Found ${totalChanges} membership changes across all groups`)

    // Build historical membership for each group
    const historicalMembers: HistoricalGroupMembers = {}

    for (const group of groups) {
        console.log(`Processing group: ${group.id} (${group.name})`)

        // Get current members for this group
        const currentMembers = await getCurrentGroupMembers(userServiceClient, accountId, group.id)

        // Get changes for this group
        const groupChanges = changesByGroup.get(group.id) || []

        // Build historical membership for this group
        historicalMembers[group.id] = buildHistoricalMembershipForGroup(
            currentMembers,
            groupChanges,
            startDate,
            endDate
        )
    }

    // Also process groups that no longer exist but have historical changes
    for (const [groupId, changes] of changesByGroup) {
        if (!historicalMembers[groupId]) {
            console.log(`Processing deleted group: ${groupId}`)
            // For deleted groups, assume no current members
            historicalMembers[groupId] = buildHistoricalMembershipForGroup(
                [],
                changes,
                startDate,
                endDate
            )
        }
    }

    // Output results
    const outputPath = `/tmp/historical_group_members_${accountId}_${Date.now()}.json`
    const jsonOutput = JSON.stringify(historicalMembers, null, 2)

    writeFileSync(outputPath, jsonOutput)

    console.log("\nHistorical group members saved")
    console.log(`Results saved to: ${outputPath}`)
    console.log(`Total groups processed: ${Object.keys(historicalMembers).length}`)
})().catch(error => {
    console.error("Error:", error)
    process.exit(1)
})