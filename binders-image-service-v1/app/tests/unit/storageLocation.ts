import { replaceStorageAccountInStorageLocation } from "../../src/helper/storageLocation";

const VISUALS_TEST_DATA = [
    {
        "storageLocation": "azure://visuals/images-production/AVYi/HqYo/KHzLSFuV5p6Z/img-73bfcf4b-5315-4072-8869-7e0615d384e8/ORIGINAL",
        "size": 130264,
        "height": 733,
        "width": 733,
        "format": 0,
        "container": ""
    },
    {
        "storageLocation": "azure://visuals/images-production/AVYi/HqYo/KHzLSFuV5p6Z/img-73bfcf4b-5315-4072-8869-7e0615d384e8/THUMBNAIL",
        "size": 2370,
        "height": 100,
        "width": 100,
        "format": 2,
        "container": ""

    }, {
        "storageLocation": "azure://visuals/images-production/AVYi/HqYo/KHzLSFuV5p6Z/img-73bfcf4b-5315-4072-8869-7e0615d384e8/MEDIUM",
        "size": 12261,
        "height": 300,
        "width": 300,
        "format": 1,
        "container": ""
    }
]

const NEW_STORAGE_TEST_DATA = [
    {
        "storageLocation": "azure://binderprodvisuals/images-production/AVYi/HqYo/KHzLSFuV5p6Z/img-73bfcf4b-5315-4072-8869-7e0615d384e8/ORIGINAL",
        "size": 130264,
        "height": 733,
        "width": 733,
        "format": 0,
        "container": ""
    },
    {
        "storageLocation": "azure://binderprodvisuals/images-production/AVYi/HqYo/KHzLSFuV5p6Z/img-73bfcf4b-5315-4072-8869-7e0615d384e8/THUMBNAIL",
        "size": 2370,
        "height": 100,
        "width": 100,
        "format": 2,
        "container": ""
    }
]

const OTHER_STORAGE_TEST_DATA = [
    {
        "storageLocation": "azure://font/images-production/AVYi/HqYo/KHzLSFuV5p6Z/img-73bfcf4b-5315-4072-8869-7e0615d384e8/ORIGINAL",
        "size": 130264,
        "height": 733,
        "width": 733,
        "format": 0,
        "container": ""
    },
    {
        "storageLocation": "azure://font/images-production/AVYi/HqYo/KHzLSFuV5p6Z/img-73bfcf4b-5315-4072-8869-7e0615d384e8/THUMBNAIL",
        "size": 2370,
        "height": 100,
        "width": 100,
        "format": 2,
        "container": ""
    }
]

const MEDIA_SERVICE_TEST_DATA = [
    {
        "storageLocation": "azurems://asset-b0f2757b-ac28-4c17-893f-d83b15ef93dc/THUMBNAIL_000001VIDEO_SCREENSHOT",
        "size": 130264,
        "height": 733,
        "width": 733,
        "format": 0,
        "container": ""
    },
    {
        "storageLocation": "azurems://asset-b0f2757b-ac28-4c17-893f-d83b15ef93dc/THUMBNAIL_000001VIDEO_SCREENSHOT",
        "size": 2370,
        "height": 100,
        "width": 100,
        "format": 2,
        "container": ""
    }
]


const OLD_STORAGE_ACCOUNT = "visuals"
const NEW_STORAGE_ACCOUNT = "binderprodvisuals"

describe("storage location helper", () => {
    it("should replace visuals storage", () => {
        const formats = replaceStorageAccountInStorageLocation(VISUALS_TEST_DATA, OLD_STORAGE_ACCOUNT, NEW_STORAGE_ACCOUNT)
        for (const format of formats) {
            expect(format.storageLocation).toMatch(new RegExp(`^azure://${NEW_STORAGE_ACCOUNT}/.*`))
        }
    });

    it("should not change new storage account", () => {
        const formats = replaceStorageAccountInStorageLocation(NEW_STORAGE_TEST_DATA, OLD_STORAGE_ACCOUNT, NEW_STORAGE_ACCOUNT)
        for (let i = 0; i < NEW_STORAGE_TEST_DATA.length; i++) {
            expect(formats[i].storageLocation).toEqual(NEW_STORAGE_TEST_DATA[i].storageLocation)
        }
    });

    it("should not touch other storage account", () => {
        const formats = replaceStorageAccountInStorageLocation(OTHER_STORAGE_TEST_DATA, OLD_STORAGE_ACCOUNT, NEW_STORAGE_ACCOUNT)
        for (let i = 0; i < OTHER_STORAGE_TEST_DATA.length; i++) {
            expect(formats[i].storageLocation).toEqual(OTHER_STORAGE_TEST_DATA[i].storageLocation)
        }
    });

    it("should not touch azure media service storage locations", () => {
        const formats = replaceStorageAccountInStorageLocation(MEDIA_SERVICE_TEST_DATA, OLD_STORAGE_ACCOUNT, NEW_STORAGE_ACCOUNT)
        for (let i = 0; i < MEDIA_SERVICE_TEST_DATA.length; i++) {
            expect(formats[i].storageLocation).toEqual(MEDIA_SERVICE_TEST_DATA[i].storageLocation)
        }
    });
});