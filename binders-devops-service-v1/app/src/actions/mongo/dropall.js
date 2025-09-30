console.log("Are you sure you wanna do this?");
process.exit(1);

var dbs = db.getMongo().getDBNames()
for(var i in dbs){
    db = db.getMongo().getDB( dbs[i] );
    var dbName = db.getName();
    if (dbName.endsWith("_service") || dbName.startsWith("binders-")) {
        print( "dropping db " + dbName);
        db.dropDatabase();
    } else {
        print("not touching db " + dbName);
        continue;
    }
}