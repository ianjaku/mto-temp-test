
export default function sleep(napTimeInMs: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, napTimeInMs));
}
