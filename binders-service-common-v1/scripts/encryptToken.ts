import { publicEncrypt as encrypt } from "crypto";

const publicKey = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA7IgkD7gud737WFRSl4y30gioDEbyz+RhH2NtGuxT5906fbkjiOrtae3nAQ+XMgLfPsm3p0Z4SBxQ4xxv3iYtGOFjxKxIZrzy6wt0OcBPAznxwni3l0SDlDLDiFkPc+Lan23DfhcpBgWmpk0vVTvXwB24PVUHnMs111HiX0zu6vMyl1WH9eEu845YuHaUg7xwh+qftrCruYXZKgJV1o0GYHhr+OVlujUTp3bq0FRLeZzeKGe2fmQ8WJKKow79G8ROFQ/ivcWkYZ6pseFdaMG4Lb9GNIl7clbPQOWzHQZ7FBBfxitkP1SeXJG5xffrYB7BqGLU4RN0+/BXMyXj+7sliQIDAQAB\n-----END PUBLIC KEY-----";
const CHUNKSIZE = 214;

const redwareSampleData = {
    UserToDealerID: 290,
    SalesRegionID: 4,
    NSCID: 77,
    SalesAreaRegionID: 0,
    EnrolmentID: 0,
    UserToDealerJobRoles: [
        {
            UserToDealerJobRoleID: 218183,
            JobRoleID: 31
        },
        {
            UserToDealerJobRoleID: 125216,
            JobRoleID: 40
        },
        {
            UserToDealerJobRoleID: 246275,
            JobRoleID: 106
        },
        {
            UserToDealerJobRoleID: 246276,
            JobRoleID: 107
        },
        {
            UserToDealerJobRoleID: 246277,
            JobRoleID: 108
        }
    ]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

(async function doIt() {

    const chunks = [] as string[];

    let sampleDataStr = JSON.stringify(redwareSampleData);

    while (sampleDataStr.length > CHUNKSIZE) {
        chunks.push(sampleDataStr.substring(0, CHUNKSIZE));
        sampleDataStr = sampleDataStr.substring(CHUNKSIZE);
    }
    chunks.push(sampleDataStr);

    let toEncrypt = await chunks.reduce(async (accPromise, chunk) => {
        const acc = await accPromise;
        const encryptedChunk = await encrypt(publicKey, Buffer.from(chunk)).toString("base64");
        return acc.concat(`${encryptedChunk},`);
    }, Promise.resolve(""));
    toEncrypt = toEncrypt.endsWith(",") ? toEncrypt.substring(0, toEncrypt.length - 1) : toEncrypt;

    const encrypted = Buffer.from(toEncrypt).toString("base64");
    // eslint-disable-next-line no-console
    console.log("encrypted payload:", encrypted);
})();
