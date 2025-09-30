/* eslint-disable no-console */
/**
* Script to add video start and end time to the first visual in a binder.
*
* Usage:
*   yarn workspace @binders/binders-v3 node dist/src/scripts/trim-video -- -b <binderId> [-s <startTimeSeconds>] [-e <endTimeSeconds>]
* 
*/
import { Binder, IBinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../repositoryservice/repositories/binderrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { main } from "@binders/binders-service-common/lib/util/process";

// Extended interface to include the timing fields (already defined in validation)
interface IBinderVisualWithTiming extends IBinderVisual {
    startTimeMs?: number;
    endTimeMs?: number;
}

const program = new Command();

program
    .name("trim-video")
    .description("Add start and end time to the first visual in a binder")
    .option("-b, --binderId <binderId>", "The binder ID to modify")
    .option("-s, --startTime <startTime>", "Start time in seconds", "3")
    .option("-e, --endTime <endTime>", "End time in seconds", "10");

async function getBinderRepository() {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config, "trim-video");
    const helper = new DefaultESQueryBuilderHelper(config);
    return new ElasticBindersRepository(config, logger, helper);
}

function findFirstVisual(binder: Binder): { chunkIndex: number; itemIndex: number; visual: string | IBinderVisual } | null {
    const imageModules = binder.modules?.images?.chunked;
    if (!imageModules || imageModules.length === 0) {
        return null;
    }

    for (let chunkIndex = 0; chunkIndex < imageModules.length; chunkIndex++) {
        const chunks = imageModules[chunkIndex].chunks;
        if (!chunks || chunks.length === 0) continue;

        for (let itemIndex = 0; itemIndex < chunks.length; itemIndex++) {
            const chunkItems = chunks[itemIndex];
            if (!chunkItems || chunkItems.length === 0) continue;

            // Return the first visual found
            return {
                chunkIndex,
                itemIndex,
                visual: chunkItems[0]
            };
        }
    }

    return null;
}

function convertToBinderVisual(visual: string | IBinderVisual): IBinderVisualWithTiming {
    // If it's already an object with properties, extend it
    if (typeof visual === "object" && visual !== null) {
        return visual as IBinderVisualWithTiming;
    }
    
    // If it's a string URL, we need to extract the ID and create a proper object
    if (typeof visual === "string") {
        // Extract ID from URL if possible, or use the string as ID
        const urlMatch = visual.match(/(?:vid-|img-)([a-f0-9-]+)/);
        const id = urlMatch ? urlMatch[0] : visual;
        
        return {
            id,
            url: visual,
            fitBehaviour: "fit",
            bgColor: "ffffff",
            languageCodes: [],
            status: "accepted"
        };
    }
    
    throw new Error(`Unexpected visual format: ${typeof visual}`);
}

main(async () => {
    program.parse(process.argv);
    const { binderId, startTime, endTime } = program.opts();
    
    if (!binderId) {
        console.error("Error: Binder ID is required. Use -b or --binderId option.");
        process.exit(1);
    }

    const startTimeMs = parseInt(startTime) * 1000; // Convert seconds to milliseconds
    const endTimeMs = parseInt(endTime) * 1000;

    if (startTimeMs >= endTimeMs) {
        console.error("Error: Start time must be less than end time.");
        process.exit(1);
    }

    try {
        const repository = await getBinderRepository();
        
        console.log(`Fetching binder ${binderId}...`);
        const binder = await repository.getBinder(binderId);
        
        console.log("Finding first visual in binder...");
        const firstVisualInfo = findFirstVisual(binder);
        
        if (!firstVisualInfo) {
            console.error("Error: No visuals found in binder.");
            process.exit(1);
        }

        const { chunkIndex, itemIndex, visual } = firstVisualInfo;
        
        // Convert to proper IBinderVisual object and add timing
        const updatedVisual = convertToBinderVisual(visual);
        updatedVisual.startTimeMs = startTimeMs;
        updatedVisual.endTimeMs = endTimeMs;

        console.log(`Adding timing to visual ID: ${updatedVisual.id}`);
        console.log(`Start time: ${startTime}s (${startTimeMs}ms)`);
        console.log(`End time: ${endTime}s (${endTimeMs}ms)`);

        // Update the visual in the binder structure
        binder.modules.images.chunked[chunkIndex].chunks[itemIndex][0] = updatedVisual;

        console.log("Updating binder in repository...");
        await repository.updateBinder(binder);
        
        console.log("✅ Successfully added video timing to first visual!");
        console.log(`Modified visual at chunk ${chunkIndex}, item ${itemIndex}`);
        
    } catch (error) {
        console.error("Error modifying binder:", error.message);
        process.exit(1);
    }
}); 