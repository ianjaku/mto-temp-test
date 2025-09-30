import { appendChild, createDocumentFragment, createElement } from "parse5/lib/tree-adapters/default";
import { parseFragment, serialize } from "parse5";

export interface ChunkSplitOptions {
    maxChunkSize: number;
}

export const MT_SPLIT_OPTIONS: ChunkSplitOptions = {
    maxChunkSize: 4500,
}


interface NodePosition {
    node: Node;
    childIndex: number;
}

const META_POSITION_ATTRIBUTE = "mpa";

export class HTMLTreeIterator {

    constructor (readonly path: NodePosition[]) {
        if (path.length === 0) {
            throw new Error("Invalid node path. Cannot be empty.")
        }
    }

    current(): Node {
        if (this.path.length === 0) {
            return undefined;
        }
        const { node, childIndex } = this.path[this.path.length - 1];
        if (node.childNodes === undefined) {
            return undefined;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const element: any = node.childNodes[childIndex];
        const attrs = (element && element.attrs) || [];
        const positionAttr = attrs.find( a => a.name === META_POSITION_ATTRIBUTE );
        if (element && positionAttr === undefined) {
            const position = this.path
                .map(p => p.childIndex)
                .join(".");
            attrs.push({ name: META_POSITION_ATTRIBUTE, value: position });
            element.attrs = attrs;
        }
        return element;
    }

    next(): void {
        if (this.path.length === 0) {
            return;
        }
        const currentPos = this.path.length - 1;
        const newIndex = this.path[currentPos].childIndex + 1;
        this.path[currentPos].childIndex = newIndex;
    }

    descend(): void {
        this.path.push({
            node: this.current(),
            childIndex: 0
        })
    }

    ascend(): void {
        this.path.pop();
    }

    isValid(): boolean {
        return this.path.length > 0;
    }

    hasMoreLeafs(): boolean {
        const currentPosIndex = this.path.length - 1;
        const currentPos = this.path[currentPosIndex];
        return currentPos.node.childNodes !== undefined &&
            currentPos.childIndex < currentPos.node.childNodes.length;
    }
}

function transferNode(parent: Element, element: Element) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const child = createElement( element.tagName, element.namespaceURI, (element as any).attrs)
    appendChild(parent, child);
    return child;
}

function createNewFragment(path: NodePosition[]) {
    const frag = createDocumentFragment();
    let parent = frag;
    for (let i = 0; i < path.length - 1; i++) {
        const pathChildIndex = path[i].childIndex;
        const pathNode = path[i].node
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pathElement: any = pathNode.childNodes[pathChildIndex];
        const child = transferNode(parent, pathElement);
        parent = child;
    }
    return { head: frag, tail: parent };
}



export function splitChunks(html: string, options: ChunkSplitOptions): string[] {
    const maxSize = options.maxChunkSize;
    if (html.length < maxSize) {
        return [html];
    }
    const chunks = [];
    let currentChunk;
    let currentChunkAddPosition;
    let isEmpty;
    let currentChunkSerialized;

    const fragment = parseFragment(html);
    const iterator = new HTMLTreeIterator([{ node: fragment, childIndex: 0}]);
    function resetCurrentChunk () {
        const newFragment = createNewFragment(iterator.path);
        currentChunk = newFragment.head;
        currentChunkAddPosition = newFragment.tail;
        currentChunkSerialized = serialize(currentChunk)
        isEmpty = true;
    }
    function addNewChildNode(newNode) {
        appendChild(currentChunkAddPosition, newNode);
        currentChunkSerialized = serialize(currentChunk);
        isEmpty = false;
        iterator.next();
    }
    function addChunk() {
        chunks.push(currentChunkSerialized);
    }

    resetCurrentChunk();
    do {
        const currentNode = iterator.current();
        if (currentNode) {
            const currentNodeSerialized = serialize(currentNode);
            if (currentChunkSerialized.length + currentNodeSerialized.length > maxSize) {
                if (isEmpty) {
                    iterator.descend();
                    resetCurrentChunk();
                } else {
                    addChunk();
                    resetCurrentChunk();
                }
            } else {
                addNewChildNode(currentNode);
            }
        } else {
            if (iterator.isValid()) {
                iterator.ascend();
                iterator.next();
                if (!isEmpty) {
                    addChunk();
                }
                resetCurrentChunk();
            }
        }
    } while (iterator.isValid());
    if (!isEmpty) {
        addChunk();
    }
    return chunks;
}

function transferChildren(parent: Element, toTransfer: Element) {
    const children = toTransfer.childNodes || [];
    for (let i = 0; i < children.length; i++) {
        appendChild(parent, children[i]);
    }
}

function extractPositionValue(element): string {
    const positionAttr = (element.attrs || [])
        .find(a => a.name === META_POSITION_ATTRIBUTE);
    return positionAttr && positionAttr.value;
}

function hasPositionAttribute(element): boolean {
    return (element.attrs || []).find(a => a.name === META_POSITION_ATTRIBUTE) !== undefined;
}

function findUniqueElements(target: Element, toInvestigate: Element) {
    if (!toInvestigate.childNodes || !target.childNodes) {
        return { sharedParent: target, finalSharedNode: toInvestigate };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstChildToInvestigate: any = toInvestigate.childNodes[0];
    const firstChildToInvestigatePosition = extractPositionValue(firstChildToInvestigate);
    if (!firstChildToInvestigatePosition) {
        return { sharedParent: target, finalSharedNode: toInvestigate };
    }
    for (let i = 0; i < target.childNodes.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const targetChild: any = target.childNodes[i];
        const targetChildPosition = extractPositionValue(targetChild);
        if (targetChildPosition && targetChildPosition === firstChildToInvestigatePosition) {
            return findUniqueElements(targetChild, firstChildToInvestigate)
        }
    }
    return { sharedParent: target, finalSharedNode: toInvestigate };
}

function removePositionMetas(element: Element): void {
    function removePositionFromCurrent() {
        do {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const current: any = iterator.current();
            if (current && hasPositionAttribute(current)) {
                iterator.descend();
                removePositionFromCurrent();
                iterator.ascend();
                const attrs = current.attrs.filter(a => a.name !== META_POSITION_ATTRIBUTE);
                current.attrs = attrs;
            }
            iterator.next();
        } while (iterator.hasMoreLeafs());
    }
    const iterator = new HTMLTreeIterator([{ node: element, childIndex: 0 }]);
    removePositionFromCurrent();
}

export function mergeChunks(toMerge: string[]): string {
    if (toMerge.length === 0) {
        return "";
    }
    const fragments = toMerge.map(serialized => parseFragment(serialized));
    const mergedFragment = fragments[0];
    for (let i = 1; i < fragments.length; i++) {
        const { sharedParent, finalSharedNode } = findUniqueElements(mergedFragment, fragments[i]);
        transferChildren(sharedParent, finalSharedNode);
    }
    removePositionMetas(mergedFragment);
    return serialize(mergedFragment);
}