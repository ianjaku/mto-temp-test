/* eslint-disable no-console */
import {
    BackendAccountServiceClient,
    BackendRepoServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { MongoBinderVisualRepositoryFactory } from "../api/repositories/binderVisualRepository";
import mongoose from "mongoose";

const SCRIPT_NAME = "check-failed-ams-assets";
const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config, SCRIPT_NAME);

const assets = [
    "asset-6cd7c187-cca8-4b1d-8d9c-de0b9e1dd171",
    "asset-9ee25e24-ce14-464a-b4e3-97dd2227dd94",
    "asset-f5949657-4699-4029-9483-2f6cbb31a3cb",
    "asset-a3635656-20b4-4ecb-83dc-d6ec71181d88",
    "asset-9f952dbc-1e55-47fc-a306-5bf823c87bc5",
    "asset-9e9f177a-0b66-46d2-967e-2a35a083d563",
    "asset-ee74f955-703b-4463-aba5-ad3d8728bcf3",
    "asset-ca2c724c-8e63-46b2-91bf-4c414ec8a29e",
    "asset-d0003d71-3b28-4a76-a6fc-914dc1616cd4",
    "asset-22b73155-8ec2-4d5f-a0ca-bb6848f361ae",
    "asset-f0788b3a-bb11-4abd-8d01-886c180790cc",
    "asset-75acd7a4-e857-4577-94b9-0aee88b3d072",
    "asset-de3a866c-4f40-46ff-9e64-9b1b50aa71d4",
    "asset-561f3b81-21fb-44eb-a4e5-ea20cf0101b5",
    "asset-984a357f-f6ad-48c9-9546-97f028401065",
    "asset-8ed6f3e3-a68a-4e34-b8a4-d36c6da95820",
    "asset-b8efaae0-e2b4-4389-99e0-f9917e9a935d",
    "asset-91c44fc0-3f23-4d4d-8204-bcc5db58eca9",
    "asset-99ece32c-bf02-4935-a879-0bd80c1286b4",
    "asset-92563fbb-451c-4f19-afdb-89d2aa4f899a",
    "asset-9b779429-a173-4baa-a218-bc9fc0f5b121",
    "asset-8c1e6bbf-cd65-448c-9fe3-a3c0c8d449ef",
    "asset-59c34e2b-e16f-467c-8e25-1c8c328ca0f6",
    "asset-360281d0-1808-483a-ac6a-f01a83b3ebaf",
    "asset-3144b131-e38c-4268-9906-ff1b05dd7991",
    "asset-2a3ed480-9086-4f2c-9d6c-ab7180ea18f0",
    "asset-03c3db6c-7714-4256-9adc-5ea77717ef1e",
    "asset-736d85ac-ce82-4ba2-bebe-c961e87bede7",
    "asset-c7b5e04b-1ff4-432f-b4e5-db3586df6504",
    "asset-9ef891dd-2661-488a-b5ea-bc1b28f3cc06",
    "asset-dcf0c3d2-6bb5-40aa-b61e-782db8d69a00",
    "asset-bd392e72-a066-4693-8a19-1becba466ffa",
    "asset-c1e63cf1-b04c-40fd-aaf6-fe633885b1dd",
    "asset-51bc73a3-b5c9-4d38-bb7f-b1845cd5ad6a",
    "asset-ccdb4763-57b9-4172-9a60-0898474476f1",
    "asset-1e98c275-cf8c-47fb-bef2-d6fee7bff37c",
    "asset-1136f5d9-38b1-4dd3-b237-a317a95d0415",
    "asset-1ae245ba-54bf-4d4a-ab0b-1f255698dd44",
    "asset-15252cab-8f2a-4272-91fa-8c0b0f50e5ab",
    "asset-006a5594-a00c-4bc3-a762-54c9a7f0dd4f",
    "asset-7b5587f0-7e03-40f2-bb61-78a41bf8a1ec",
    "asset-c6258695-5730-44f3-b18a-ad6da7fec804",
    "asset-17b40a3f-0e99-4f02-8f10-3fe830676675",
    "asset-318f4e3d-626e-4b6e-855a-8d0415c137f5",
    "asset-45282df7-cecb-4437-813e-9e28b2837325",
    "asset-0cfa8a89-35bc-47d5-95ed-b469678b5494",
    "asset-20363e77-0eef-4db6-8d61-3601b8c67b1a",
    "asset-41e81748-4710-41b8-99a0-fb7b1e1d3ca9",
    "asset-265984d7-ab83-4928-9ff6-8a442b0649f1",
    "asset-98429fc9-2873-4723-a1b8-cef3c0e9adff",
    "asset-e76fad02-7c44-4ce7-824d-27d490117683",
    "asset-d9246170-d201-4a87-910c-c555ad786ae8",
    "asset-e9c61876-5b8e-47fb-b497-923dd5a99be4",
    "asset-d9363b73-9cb3-47e5-b4b1-dcd641f746e4",
    "asset-10b51006-aedd-481b-ac1e-0a243c332298",
    "asset-d4d9d465-6820-4b76-8584-b836c0a18899",
    "asset-afb7b9fd-2d6b-4b5a-ab0b-247b46c5db20",
    "asset-1c7bbbba-e67f-495a-94bf-d2db743f4943",
    "asset-24d781e6-b3e3-4bdf-85f6-daea41f0aa25",
    "asset-092fa676-e491-4ed7-b938-e5d08214e0f6",
    "asset-0ba41568-481a-4e30-983a-de488dbc9852",
    "asset-74a69053-1bc7-4fd9-b01c-1f5f61a08a9d",
    "asset-7d6952e7-9cbd-436d-86dc-a8a67942f38e",
    "asset-7184cfee-4a65-4e8c-b038-acd187e84926",
    "asset-21d68f43-5a9f-49f1-bbd7-3ec7219e29b6",
    "asset-71fcdbd7-a0e4-4235-91d2-9a60e5310597",
    "asset-61ef5fb8-924c-4c96-9001-dbe532e0041c",
    "asset-335495fa-8628-4044-bd0e-8bef8e63c6d9",
    "asset-00cd4876-9078-418f-ae2a-f98a77045bd5"
]

async function queryVisual(visualRepository, container: string) {
    const query = {
        "formats.container": mongoose.trusted({
            $regex: container,
            $options: "i"
        })
    }
    return visualRepository.queryVisuals(query, 1)

}


const doIt = async () => {
    const binderVisualRepository = await getBinderVisualRepository()
    const repoServiceClient = await BackendRepoServiceClient.fromConfig(config, SCRIPT_NAME);
    const accountClient = await BackendAccountServiceClient.fromConfig(config, SCRIPT_NAME);

    const assetsToKeep = []
    const assetsToDelete = []

    for (const assetId of assets) {
        const visuals = await queryVisual(binderVisualRepository, assetId)

        if (visuals.length > 0) {
            const visual = visuals[0]

            let binder
            try {
                binder = await repoServiceClient.getBinder(visual.binderId)
            } catch (error) {
                console.log("Missing binder with id: ", visual.binderId)
                continue
            }
            const account = await accountClient.getAccount(binder.accountId)
            const obj = { assetId, accountId: binder.accountId, account: account.name }
            console.log(obj)
            assetsToKeep.push(obj)
        } else {
            console.log(`asset ${assetId} is not liked with any binder`)
            assetsToDelete.push(assetId)
        }
    }
    console.log("=============== SUMMARY ===============")
    console.log("Number of assets to keep: ", assetsToKeep.length)
    console.log("Items to keep", assetsToKeep)
    console.log("Number of assets to delete: ", assetsToDelete.length)
    console.log("Items to delete", assetsToDelete)

}

doIt().then(
    () => {
        console.log("All done!");
        process.exit(0);
    },
    err => {
        console.error(err);
        process.exit(1);
    }
)

async function getBinderVisualRepository() {
    const loginOption = getMongoLogin("image_service");
    const collectionConfig = await CollectionConfig.promiseFromConfig(config, "images", loginOption);
    return new MongoBinderVisualRepositoryFactory(collectionConfig, logger).build(logger);
}
