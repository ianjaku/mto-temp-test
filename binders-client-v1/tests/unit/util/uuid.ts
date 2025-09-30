import UUID from "../../../src/util/uuid"

describe("uuid", () => {

    test("random() returns a value in the form of a uuid", () => {
        const value = UUID.random().toString();
        expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    })
    
    test("random() returns a random value", async () => {
        const values = await Promise.all([
            async () => UUID.random().toString(),
            async () => UUID.random().toString(),
            async () => UUID.random().toString(),
            async () => UUID.random().toString(),
        ]);

        expect(new Set(values).size).toBe(values.length);
    });
    
});
