import { AncestorTree } from "../../../src/ancestors";

const topCollection = {
    id: "top",
    keys: [ "middle1", "middle2" ]
};
const midCollection1 = {
    id: "middle1",
    keys: [ "bottom1.1", "bottom1.2" ]
};
const midCollection2 = {
    id: "middle2",
    keys: [ "bottom2.1" , "bottom2.2" ]
}


function checkDescendents(docTree: AncestorTree) {
    expect(docTree.isDescendentOf("bottom2.1", "middle2")).toEqual(true);
    expect(docTree.isDescendentOf("bottom2.1", "top")).toEqual(true);
    expect(docTree.isDescendentOf("middle2", "top")).toEqual(true);
    expect(docTree.isDescendentOf("bottom1.1", "middle1")).toEqual(true);
    expect(docTree.isDescendentOf("bottom1.1", "middle2")).toEqual(false);
    expect(docTree.isDescendentOf("nonexisting", "middle2")).toEqual(false);
    expect(docTree.isDescendentOf("bottom1.1", "nonexisting")).toEqual(false);
}

it("simple two level tree", () => {
    const docTree = new AncestorTree();
    docTree.addCollectionByIds(topCollection.id, topCollection.keys);
    docTree.addCollectionByIds(midCollection1.id, midCollection1.keys);
    docTree.addCollectionByIds(midCollection2.id, midCollection2.keys);
    checkDescendents(docTree);
});

it("serialization works", () => {
    const docTree = new AncestorTree();
    docTree.addCollectionByIds(topCollection.id, topCollection.keys);
    docTree.addCollectionByIds(midCollection1.id, midCollection1.keys);
    docTree.addCollectionByIds(midCollection2.id, midCollection2.keys);
    expect(JSON.stringify(docTree)).toEqual("{\"middle1\":[\"top\"],\"middle2\":[\"top\"],\"bottom1.1\":[\"middle1\"],\"bottom1.2\":[\"middle1\"],\"bottom2.1\":[\"middle2\"],\"bottom2.2\":[\"middle2\"]}")
});

it("conversion to/from JSON works", () => {
    const docTree = new AncestorTree();
    docTree.addCollectionByIds(topCollection.id, topCollection.keys);
    docTree.addCollectionByIds(midCollection1.id, midCollection1.keys);
    docTree.addCollectionByIds(midCollection2.id, midCollection2.keys);
    const deserialized = AncestorTree.fromJSON(docTree.toJSON());
    checkDescendents(deserialized);
})