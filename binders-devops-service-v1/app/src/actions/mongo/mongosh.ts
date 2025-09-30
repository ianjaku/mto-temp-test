/* eslint-disable no-console */
import { exec } from "child_process";
import { promisify } from "util";

// Promisify the exec function to use with async/await
const execAsync = promisify(exec);

/**
 * Function to execute a MongoDB script inside a Kubernetes pod using `kubectl exec`.
 * @param podName - Name of the MongoDB pod.
 * @param namespace - Kubernetes namespace where the pod is running.
 * @param username - MongoDB username.
 * @param password - MongoDB password.
 * @param scriptPath - Path to the MongoDB script inside the pod.
 * @returns Promise<void>
 */
export const executeMongoScript = async (
    podName: string,
    namespace: string,
    username: string,
    password: string,
    scriptPath: string
): Promise<{ output: string }> => {
    const command = `kubectl exec -i ${podName} --namespace ${namespace} -- mongosh -u ${username} -p ${password} --authenticationDatabase "admin" < ${scriptPath}`;

    try {
        const { stdout, stderr } = await execAsync(command);
        if (stderr) {
            console.error(`Command error output: ${stderr}`);
            throw new Error(stderr);
        }
        return { output: stdout }
    } catch (error) {
        console.error(`Error executing command: ${error.message}`);
        throw new Error(`Failed to execute MongoDB script: ${error.message}`);
    }
};


