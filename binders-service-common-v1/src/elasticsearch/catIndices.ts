import * as elastic from "@elastic/elasticsearch";

function parseCatIndexResult<T>(result, transform: (parts: string[]) => T) {
    const indices = [];
    const lines = result.body.split("\n");
    lines.forEach(line => {
        if (line.trim() !== "") {
            const lineParts = line.split(/\s+/);
            indices.push(transform(lineParts));
        }
    })
    return indices;
}

export async function getIndexNames(client: elastic.Client, pattern?: string): Promise<string[]> {
    const result = await client.cat.indices({ h: "index", index: pattern});
    return parseCatIndexResult(result, p => p[0]);
}

export async function getDocCountByIndexName(client: elastic.Client): Promise<Record<string, number>> {
    const elasticResult = await client.cat.indices({h: "index,docs.count"});
    const rows = parseCatIndexResult(
        elasticResult,
        p => ( { index: p[0], count: Number.parseInt(p[1], 10) } )
    );
    const result = {};
    rows.forEach(row => {
        result[row.index] = row.count;
    });
    return result;
}