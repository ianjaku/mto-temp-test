export default {
    id: "fetchRailwaysFromProduction",
    name: "Load the rails manual from production",
    async run(): Promise<void> {
        await fetch("https://demo.manual.to/railways");
    },
    expectedTimings: {
        normal: 1000,
        maximum: 3000
    }
}
