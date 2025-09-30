
interface CacheEntry<V> {
    value: V;
    expiresAt: number;
}



export class TTLCache<K, V> {

    private values: Map<K, CacheEntry<V>>;

    constructor(private ttlInMs: number) {
        this.values = new Map<K,CacheEntry<V>>();
    }

    async get(key: K, builder: () => Promise<V>): Promise<V> {
        let entry = this.values.get(key);
        if (entry === undefined || this.entryHasExpired(entry)) {
            entry = {
                value: await builder(),
                expiresAt: (new Date().getTime() + this.ttlInMs)
            }
            this.values.set(key, entry);
        }
        return entry.value;
    }

    private entryHasExpired(entry: CacheEntry<V>) {
        const now = new Date();
        return now.getTime() > entry.expiresAt;
    }
}