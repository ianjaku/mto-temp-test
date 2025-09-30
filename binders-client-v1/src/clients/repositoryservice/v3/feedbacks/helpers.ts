import { IBinderFeedback } from "../contract";
import { dateSorterDesc } from "../../../../util/date";

export function calculateAverageRating(feedbacks: IBinderFeedback[]): number {
    const feedbacksByUser = feedbacks
        .filter(f => f.rating != null)
        .reduce((res, f) => {
            const userId = f.userId ?? "anonymous";
            if (!res.has(userId)) res.set(userId, []);
            return res.set(userId, [...res.get(userId), f]);
        }, new Map<string, IBinderFeedback[]>());
    const lastUsersRatings = [...feedbacksByUser.entries()]
        .map(([_, userFeedbacks]) => {
            const sortedFeedbacks = userFeedbacks.sort((a, b) => dateSorterDesc(a.created, b.created));
            const lastFeedback = sortedFeedbacks[0];
            return lastFeedback.rating;
        });
    const avgRating = lastUsersRatings.reduce((sum, rating) => sum + rating, 0) / lastUsersRatings.length;
    const roundedAvgRating = Math.round(avgRating * 10) / 10;
    return roundedAvgRating;
}

