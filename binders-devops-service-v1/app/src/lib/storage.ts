import {
    deletePersistentVolumeClaim,
    getPersistentVolume,
    getPersistentVolumeClaims
} from  "../actions/k8s/volumes";
import { deleteDisk } from "../actions/aks/disks";
import { log } from "util";
import { sequential } from "./promises";

export const cleanPersistantItems = async (aksClusterName: string, helmReleaseName: string, namespace: string): Promise<void> => {
    const claims = await getPersistentVolumeClaims();
    const claimsToDelete = claims.filter(claim => claim.metadata.name.startsWith(helmReleaseName));
    const claimNamesToDelete = claimsToDelete.map(claim => claim.metadata.name);
    const volumeNamesToDelete = claimsToDelete
        .map(pvc => pvc.spec.volumeName)
        .filter(pv => !!pv);
    const volumesToDelete = await volumeNamesToDelete.reduce( async (promiseSoFar, volumeName) => {
        const volumesSoFar = await promiseSoFar;
        const newVolume = await getPersistentVolume(volumeName);
        return volumesSoFar.concat([newVolume]);
    }, Promise.resolve([]));
    const azureDisksToDelete = volumesToDelete.map(vol => vol.spec.azureDisk.diskName);

    log(`Deleting ${azureDisksToDelete.length} azure disks.`);
    await sequential(
        async (disk) => {
            log(`Deleting disk ${disk}`);
            await deleteDisk(aksClusterName, disk);
        },
        azureDisksToDelete
    );

    log(`Deleting ${claimNamesToDelete.length} claims`);
    await sequential(
        async (claimName) => {
            log(`Deleting claim ${claimName}`);
            await deletePersistentVolumeClaim(claimName, namespace);
        },
        claimNamesToDelete
    );
};