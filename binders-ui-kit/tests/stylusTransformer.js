// Works around stylus file imports in the TSX files
module.exports = {
    process() {
        return {
            code: "module.exports = {};"
        };
    },
};