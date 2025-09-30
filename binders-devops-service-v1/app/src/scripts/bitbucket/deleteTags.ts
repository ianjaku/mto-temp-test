import { getAllTagsWithDate } from "../../actions/git/tags";
import { main } from "../../lib/program";
import { runCommand } from "../../lib/commands";
import { sequential } from "../../lib/promises";
import { splitEvery } from "ramda";

const doIt = async() => {
    const tags = await getAllTagsWithDate(/^mt-3.*/);
    const cutoff = new Date().getTime() - 3 * 30 * 24 * 60 * 60 * 1000;
    const oldTags = tags
        .filter( tag => {
            const tagDate = new Date(tag.split(" / ")[1]);
            return tagDate.getTime() < cutoff;
        })
        .map( tag => tag.split(" / ")[0]);

    const oldTagChunks = splitEvery(50, oldTags);
    await sequential( async(tags) => {
        await runCommand("git", ["tag", "-d", ...tags]);
        await runCommand("git", ["push", "--no-verify", "--delete", "origin", ...tags])
    }, oldTagChunks);
}

main(doIt);
