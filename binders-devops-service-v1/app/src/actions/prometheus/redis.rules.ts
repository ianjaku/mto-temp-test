import { setAlertLabels } from "./alertmgr";

const getRedisAlertRules = () => {
    return [
        {
            alert: "REDIS Up",
            expr: "sum(redis_up) < 3",
            annotations: {
                summary: "Less than 3 Redis instances are up",
                description: "The number of Redis instances that are currently running is below 3. Immediate attention is required to restore the service."
            },
            ...setAlertLabels("infra", "critical"),
        },
        {
            alert: "REDIS Slow Queries",
            expr: "irate(redis_slowlog_length[5m]) > 10",
            annotations: {
                summary: "Redis has a high rate of slow queries",
                description: "The Redis instance is experiencing a high rate of slow queries over the last 5 minutes, with more than 10 slow queries detected. This may indicate performance issues."
            },
            ...setAlertLabels("infra")
        }
    ];
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getRedisAlertRulesGroup = () => ({
    name: "redis.rules",
    rules: getRedisAlertRules()
});