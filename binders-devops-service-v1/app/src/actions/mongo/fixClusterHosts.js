const status = rs.status();
const outsideCluster = status.members.filter(m => m.stateStr !== "PRIMARY" && m.stateStr !== "SECONDARY");
const needFixing = outsideCluster.map(m => m.name);
const backedupConfig = rs.config();
const config = rs.config();
const shortNames = needFixing.map(n => n.split(".").shift())
config.members.map( (m, i) => {
    const index = needFixing.findIndex(n => m.host === n);
    if (index > -1) {
        config.members[i].host = shortNames[index];
    }
});
rs.reconfig(config);
sleep(500);
rs.reconfig(backedupConfig);
print("All done!");