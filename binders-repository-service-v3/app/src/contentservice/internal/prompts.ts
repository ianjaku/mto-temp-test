export const PROMPT_SYSTEM = `
You are a content formatting engine optimized for writing safe and understandable instructions.
You receive input along with user's description of modifications.
You are a world renown specialist in improving manuals in an understandable way for everyone regardless of their expertise or prior knowledge.

There are 3 types of manuals:
    1. How-to guides
        - examples: Production, Quality control, Software, Product guides
    2. Marketing
        - examples: Blog posts, Brochures and Event guides
    3. Internal/HR

Everything that is needed is already present in the text.
Do not omit any present information.
Do not return back the prompt.
`;

const PROMPT_OPTIMIZE_CHUNK_CONTENT = `
<rules>
The given text might be a description, or introduction to steps that will be mentioned later,
it could also contain certain set of actions that the reader needs to perform.

Use short sentences with imperative language.
If the text contains multiple actions, split the text into a list of actions
    - numbered list if the order matters
    - bullet points otherwise
If the text contains a single action, do not turn it into a list.
The optimal number of listed items is up to 5.

Highlight Extra Points of Attention:
If an action includes an additional point of attention (such as a specific way the action should be performed), include it in the same instruction.
Use emphasis, such as a tip or warning, to highlight important details without creating a separate action.

If the given text is a description, or introduction, don't add any actions nor steps.
Highlight important words with bold. Do not highlight whole sentences. Prefer highlighting single words.

Ensure correct punctuation.
Preserve existing emojis.
Use standard language. Always preserve the original language (never translate).
Insert professional and relevant emojis where applicable.
</rules>
`;

const PROMPT_OPTIMIZE_BINDER_CONTENT = `
<rules>
The given text is an XML containing the title chunk and chunks formatted in HTML.
Think of the chunks as slides in a presentation.
Format the optimized content in the same XML structure as input.
Make sure to HTML encode necessary characters in order to return valid XML.

<important>Preserve the number of chunks</important>

Highlight Extra Points of Attention:
If an action includes an additional point of attention (such as a specific way the action should be performed), include it in the same instruction.
Use emphasis, such as a tip or warning, to highlight important details without creating a separate action.

Formatting rules for How-to Guides:
- Use short sentences with <important>imperative language</important>.
- Highlight maximum 1 key verb per sentence in bold.
- Ensure correct punctuation.
- Preserve existing emojis.
- Always preserve the original language (never translate).
- Insert professional and relevant emojis where applicable.
- If the chunk text contains multiple actions, split the text into a list of actions
    - numbered list if the order matters
    - bullet points otherwise
- Do not use lists with single item.
- The optimal number of listed items is up to 5.

Formatting rules for Marketing documents:
- Highlight keywords in bold. Prefer highlighting single words.
- Ensure correct punctuation.
- Preserve existing emojis.
- Always preserve the original language (never translate).
- Insert professional and relevant emojis where applicable.
- Never return back the prompt.
</rules>

<examples>

<example name="Example of encoding special characters">
    <input>
        <manual>
        <title>How to lift a cup</title>
        <chunks>
        <chunk>Find &amp; lift the cup</chunk>
        </chunks>
        </manual>
    </input>
    <output>
        <manual>
        <title>How to lift a cup</title>
        <chunks>
        <chunk>Find &amp; lift the cup</chunk>
        </chunks>
        </manual>
    </output>
</example>


<example name="Example of using imperative language">
    <input>
        <manual>
        <title># How to change a tyre</title>
        <chunks>
        <chunk>In order to unmount the wheel, it is necessary to unscrew all the screws.</chunk>
        </chunks>
        </manual>
    </input>
    <output>
        <manual>
        <title># How to change a tyre</title>
        <chunks>
        <chunk>
        <ol>
        <li>Unscrew all of the screws.</li>
        <li>Unmount the wheel</li>
        </ol>
        </chunk>
        </chunks>
        </manual>
    </output>
</example>

<example name="Example of no ordered lists with only 1 item in a chunk">
    <input>
        <manual>
        <title>How to change a tyre</title>
        <chunks>
        <chunk><ol><li>Unscrew all of the screws.</li></ol></chunk>
        <chunk><ol><li>Unmount the wheel</li></ol></chunk>
        </chunks>
        </manual>
    </input>
    <output>
        <manual>
        <title>How to change a tyre</title>
        <chunks>
        <chunk>Unscrew all of the screws.</chunk>
        <chunk>Unmount the wheel</chunk>
        </chunks>
        </manual>
    </output>
</example>

<example name="Example of preserving the number of chunks">
    <input>
        <manual>
        <title>Baking cookies</title>
        <chunks>
        <chunk>When all cups are filled and served with chocolate, you're ready to put them in the oven.</chunk>
        <chunk>Now all you have to do is put them in the oven and wait 20 minutes while they bake at 160°C</chunk>
        </chunks>
        </manual>
    </input>
    <output>
        <manual>
        <title>Baking cookies</title>
        <chunks>
        <chunk><p><strong>Fill</strong> the cups with the batter.</p></chunk>
        <chunk>
        <ol>
        <li><strong>Preheat</strong> the oven to 160°C.</li>
        <li><strong>Put</strong> the cookies into the oven.</li>
        <li><strong>Bake</strong> for 20 minutes.</li>
        </ol>
        </chunk>
        </chunks>
        </manual>
    </output>
</example>

<examples>
`;

export function buildPromptOptimizeChunkContent(chunkMarkdown: string): string {
    return [
        "<change-description>",
        asCode(PROMPT_OPTIMIZE_CHUNK_CONTENT),
        "</change-description>",
        "",
        "<content>",
        asCode(chunkMarkdown),
        "</content>",
    ].join("\n");
}

export function buildPromptOptimizeBinderContent(binderContent: string): string {
    return [
        "<change-description>",
        asCode(PROMPT_OPTIMIZE_BINDER_CONTENT),
        "</change-description>",
        "",
        "<content>",
        asCode(binderContent),
        "</content>",
    ].join("\n");
}

export function sanitizeMarkdownResponse(markdown: string): string {
    const withoutLanguageIdentifier = removeLanguageIdentifier(markdown);
    const cleanedMarkdown = cleanUpBoundaries(withoutLanguageIdentifier);
    return cleanedMarkdown.trim();
}

/**
 * Remove language identifier from code blocks
 */
function removeLanguageIdentifier(markdown: string): string {
    return markdown.replace(/^```[a-z]+/, "```");
}

/**
*  Clean up non-alphanumeric characters (including * and #) from the start and end of the text
*/
function cleanUpBoundaries(markdown: string): string {
    return markdown.replace(/^[^a-zA-Z0-9.:#*]+|[^a-zA-Z0-9.:#*]+$/g, "");
}

const asCode = (str: string) => ["```", str, "```"].join("");
