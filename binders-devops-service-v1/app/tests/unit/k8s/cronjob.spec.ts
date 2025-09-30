import { CRON_ANY, everyNHoursSchedule } from "../../../src/actions/k8s/cronjob"

function getScheduleExpression(minute = CRON_ANY, hour = CRON_ANY, dayOfMonth = CRON_ANY, month = CRON_ANY, dayOfWeek = CRON_ANY) {
    return {
        minute,
        hour,
        dayOfMonth,
        month,
        dayOfWeek
    }
}

describe("Cron job schedule", () => {
    it("everyNHoursSchedule", () => {
        const testCases = [{
            input: {
                interval: 8,
                offset: 1
            },
            exprectedResult: getScheduleExpression("0", "1,9,17", CRON_ANY, CRON_ANY, CRON_ANY)
        }, {
            input: {
                interval: 2,
                offset: 0
            },
            exprectedResult: getScheduleExpression("0", "0,2,4,6,8,10,12,14,16,18,20,22", CRON_ANY, CRON_ANY, CRON_ANY)
        }, {
            input: {
                interval: 2,
                offset: 1
            },
            exprectedResult: getScheduleExpression("0", "1,3,5,7,9,11,13,15,17,19,21,23", CRON_ANY, CRON_ANY, CRON_ANY)
        },
        {
            input: {
                interval: 2,
                offset: 10
            },
            exprectedResult: getScheduleExpression("0", "10,12,14,16,18,20,22", CRON_ANY, CRON_ANY, CRON_ANY)
        }, {
            input: {
                interval: 2,
                offset: 10,
                minute: 20
            },
            exprectedResult: getScheduleExpression("20", "10,12,14,16,18,20,22", CRON_ANY, CRON_ANY, CRON_ANY)
        }, {
            input: {
                interval: 60,
                offset: 10,
            },
            expectedError: "Cron validation error : Hours should be >=0 and <=23"
        }, {
            input: {
                interval: 10,
                offset: 60,
            },
            expectedError: "Cron validation error : Hours should be >=0 and <=23"
        }, {
            input: {
                interval: 10,
                offset: 10,
                minute: 120
            },
            expectedError: "Cron validation error : Minutes should be >=0 and <60"
        }]
        for (const tcase of testCases) {
            const { interval, offset, minute } = tcase.input
            if (tcase.exprectedResult) {
                const result = minute ? everyNHoursSchedule(interval, offset, minute) : everyNHoursSchedule(interval, offset)
                expect(result).toEqual(tcase.exprectedResult)
            } else {
                expect(() => minute ? everyNHoursSchedule(interval, offset, minute) : everyNHoursSchedule(interval, offset)).toThrow(tcase.expectedError)
            }
        }
    })
})