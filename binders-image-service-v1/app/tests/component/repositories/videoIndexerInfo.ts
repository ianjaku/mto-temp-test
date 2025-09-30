// import * as mongoose from "mongoose";
// import { runMongoTest, TestCase } from "@binders/binders-service-common/lib/mongo/test";
// import { IVideoIndexerInfoRepository, MongoVideoIndexerInfoRepository, MongoVideoIndexerInfoRepositoryFactory, VideoIndexerInfoDAO } from "../../../src/api/videoIndexerInfoRepository";

// function runVideoIndexerInfoTest<C>(testCase: TestCase<VideoIndexerInfoDAO, C>) {
//     return runMongoTest(
//         "videoIndexerInfo",
//         (collectionConfig, logger) => Promise.resolve(new MongoVideoIndexerInfoRepositoryFactory(collectionConfig, logger)),
//         testCase
//     );
// }

// afterAll(() => new Promise(function (resolve, reject) {
//     mongoose.disconnect(function () { return resolve(undefined); });
// }));

// function getData() {
//     const videoIndexerInfo1 = {
//         audioTranscriptions: [
//             {
//                 minutes: 0,
//                 seconds: 4,
//                 milliseconds: 500,
//                 text: "Step one, rtfm",
//             }
//         ]
//     }
//     return {
//         videoIndexerInfo1
//     };
// }

// describe("managing video indexer info", () => {
//     xit("should correctly insert", () => {
//         // return runVideoIndexerInfoTest(async (repo: MongoVideoIndexerInfoRepository) => {
//         //     const { videoIndexerInfo1 } = getData();
//         //     const videoIndexerInfo = await repo.saveVideoIndexerInfo(videoIndexerInfo1);

//         //     expect(videoIndexerInfo).toEqual(1);

//         // });
//     });

// });

export default "";