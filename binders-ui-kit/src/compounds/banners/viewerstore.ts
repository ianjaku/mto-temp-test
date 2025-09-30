import { append } from "ramda";
/**
 * Stores information about who has seen something and when in localStorage.
 * Used to only show banners every X amount of time (per device, per user).
 */

interface IViewer {
    id: string;
    viewedAtMs: number;
}

export class ViewersStore {

    private cache: IViewer[];

    constructor(
        private localStorageKey: string,
        private expireTimeHours: number
    ) {}

    public hasSeen(id: string): boolean {
        if (id == null) return true;
        const viewers = this.fetchViewers();
        return viewers.some(viewer => viewer.id === id && !this.hasExpired(viewer));
    }

    public logView(id: string): void {
        let viewers = this.fetchViewers();
        viewers = viewers.filter(viewer => viewer.id !== id);
        viewers = append({
            id,
            viewedAtMs: new Date().getTime()
        }, viewers);
        this.storeViewers(viewers);
    }

    private fetchViewers(): IViewer[] {
        if (this.cache == null) {
            const viewersJson = localStorage.getItem(this.localStorageKey);
            this.cache = viewersJson != null ? JSON.parse(viewersJson) : [];
        }
        return this.cache;
    }

    private storeViewers(viewers: IViewer[]): void {
        const cleanedViewers = this.filterExpired(viewers);
        const viewersJson = JSON.stringify(cleanedViewers);
        localStorage.setItem(this.localStorageKey, viewersJson);
    }

    private filterExpired(viewers: IViewer[]): IViewer[] {
        return viewers.filter(viewer => !this.hasExpired(viewer));
    }

    private hasExpired(viewer: IViewer) {
        return viewer.viewedAtMs + this.expireTimeMs() < new Date().getTime();
    }

    private expireTimeMs() {
        return this.expireTimeHours * 60 * 60 * 1000;
    }
}

