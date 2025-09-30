
import {ObjectConfig} from "@binders/client/lib/config/config";

describe("object config", () => {
    it( "should retrieve a string by simple key", () => {
        const config = new ObjectConfig(
            { "key" : "value" }
        );
        const retrievedValue = config.getString("key");
        expect(retrievedValue.isJust()).toEqual(true);
        expect(retrievedValue.get()).toEqual("value");
    });

    it( "should retrieve a string by nested key", () => {
        const config = new ObjectConfig(
            { "key1": { "key2" : "value" } }
        );
        const retrievedValue = config.getString("key1.key2");
        expect(retrievedValue.isJust()).toEqual(true);
        expect(retrievedValue.get()).toEqual("value");
    });

    it( "should retrieve an object by simple key", () => {
        const simpleObject =  { "simple": "withValue"};
        const config = new ObjectConfig(
            { "key" : simpleObject }
        );
        const retrievedValue = config.getObject("key");
        expect(retrievedValue.isJust()).toEqual(true);
        expect(retrievedValue.get()).toEqual(simpleObject);
    });

    it( "should retrieve an object by nested key", () => {
        const simpleObject =  { "simple": "withValue"};
        const config = new ObjectConfig(
            { "key1": { "key2" : simpleObject } }
        );
        const retrievedValue = config.getObject("key1.key2");
        expect(retrievedValue.isJust()).toEqual(true);
        expect(retrievedValue.get()).toEqual(simpleObject);
    });

    it( "should retrieve an array by simple key", () => {
        const simpleArray =  [ "simple", "withValue" ];
        const config = new ObjectConfig(
            { "key" : simpleArray }
        );
        const retrievedValue = config.getArray("key");
        expect(retrievedValue.isJust()).toEqual(true);
        expect(retrievedValue.get()).toEqual(simpleArray);
    });

    it( "should retrieve an array by nested key", () => {
        const simpleArray =  [ "simple", "withValue" ];
        const config = new ObjectConfig(
            { "key1": { "key2" : simpleArray } }
        );
        const retrievedValue = config.getArray("key1.key2");
        expect(retrievedValue.isJust()).toEqual(true);
        expect(retrievedValue.get()).toEqual(simpleArray);
    });

    it( "should retrieve a number by simple key", () => {
        const simpleValue = 123;
        const config = new ObjectConfig(
            { "key" : simpleValue }
        );
        const retrievedValue = config.getNumber("key");
        expect(retrievedValue.isJust()).toEqual(true);
        expect(retrievedValue.get()).toEqual(simpleValue);
    });

    it( "should retrieve a number by nested key", () => {
        const simpleValue = 123;
        const config = new ObjectConfig(
            { "key1": { "key2" : simpleValue } }
        );
        const retrievedValue = config.getNumber("key1.key2");
        expect(retrievedValue.isJust()).toEqual(true);
        expect(retrievedValue.get()).toEqual(simpleValue);
    });
});