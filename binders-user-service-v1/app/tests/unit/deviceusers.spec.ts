import { resolveDeviceUserIds } from "../../src/userservice/helpers/deviceusers";

describe("resolveDeviceUserIds", () => {
    it("resolves empty IDs", async () => {
        expect(
            await resolveDeviceUserIds([], async () => ({}))
        ).toStrictEqual([])
    });

    it("resolves user IDs", async () => {
        const resolved = await resolveDeviceUserIds([{
            deviceUserId: "uid-0",
            userIds: ["uid-1", "uid-2"],
            resolvedUserIds: [],
            usergroupIntersections: [],
        }], async () => ({}));
        expect(resolved.at(0).resolvedUserIds.sort())
            .toStrictEqual(["uid-1", "uid-2"].sort())
    });

    it("resolves group IDs", async () => {
        const resolved = await resolveDeviceUserIds([{
            deviceUserId: "uid-0",
            userIds: ["gid-0", "gid-1"],
            resolvedUserIds: [],
            usergroupIntersections: [],
        }], async () => ({
            ["gid-0"]: ["uid-9"],
            ["gid-1"]: ["uid-9", "uid-8"],
        }));
        expect(resolved.at(0).resolvedUserIds.sort())
            .toStrictEqual(["uid-8", "uid-9"].sort())
    });

    it("resolves intersecting users in group intersections", async () => {
        expect(
            await resolveDeviceUserIds([{
                deviceUserId: "uid-0",
                userIds: [],
                resolvedUserIds: [],
                usergroupIntersections: [
                    ["gid-0", "gid-1"],
                ],
            }], async () => ({
                ["gid-0"]: ["uid-2"],
                ["gid-1"]: ["uid-2", "uid-3"],
            }))
        ).toMatchObject([
            { resolvedUserIds: ["uid-2"] },
        ])
    });

    it("resolves both target ids and intersections", async () => {
        const resolved = await resolveDeviceUserIds([{
            deviceUserId: "uid-0",
            userIds: ["uid-9", "gid-2"],
            resolvedUserIds: [],
            usergroupIntersections: [
                ["gid-0", "gid-1"],
            ],
        }], async () => ({
            ["gid-0"]: ["uid-2"],
            ["gid-1"]: ["uid-2", "uid-3"],
            ["gid-2"]: ["uid-8"],
        }))
        expect(resolved.at(0).resolvedUserIds.sort())
            .toStrictEqual(["uid-2", "uid-8", "uid-9"].sort())
    });

    it("resolves intersection as empty if one of the groups does not exist", async () => {
        const resolved = await resolveDeviceUserIds([{
            deviceUserId: "uid-0",
            userIds: [],
            resolvedUserIds: [],
            usergroupIntersections: [
                ["gid-0", "gid-1"],
            ],
        }], async () => ({
            ["gid-0"]: ["uid-2"],
        }))
        expect(resolved.at(0).resolvedUserIds).toStrictEqual([]);
    });

    it("skips users of nonexisting groups", async () => {
        const resolved = await resolveDeviceUserIds([{
            deviceUserId: "uid-0",
            userIds: ["uid-1", "gid-0", "gid-1"],
            resolvedUserIds: [],
            usergroupIntersections: [],
        }], async () => ({
            ["gid-0"]: ["uid-2"],
        }))
        expect(resolved.at(0).resolvedUserIds)
            .toStrictEqual(["uid-1", "uid-2"]);
    });
});
