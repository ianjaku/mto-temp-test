import {
    SortOrder,
    dateSorterAsc,
    dateSorterDesc,
    detectTimeZone,
    fmtDate,
    fmtDateIso8601,
    fmtDateIso8601TZ,
    fmtDateIso8601TimeLocalized,
    fmtDateIso8601TimeLocalizedTZ,
    fmtDateTimeRelative,
    fmtDateTimeWritten,
    fmtDateWritten,
    fmtNow,
    parseDateFromString,
    sortByDate,
    toTimeZoneCode,
} from "../../../src/util/date";
import { fromUnixTime, parse, setMilliseconds, startOfDay, sub } from "date-fns";
import moment from "moment";

const testDate = new Date("2014-10-22T12:49:25.000Z");

describe("fmtDate", () => {
    it("formats a date when no custom formatting is passed", () => {
        expect(fmtDate(testDate, "yyyy-MM-dd"))
            .toEqual("2014-10-22");
    });

    it("formats a date when custom locale is passed", () => {
        expect(fmtDate(testDate, "EEEE, yyyy-MM-dd", { locale: "ro" }))
            .toEqual("miercuri, 2014-10-22");
    });

    it("formats a date when custom timezone is passed", () => {
        expect(fmtDate(testDate, "yyyy-MM-dd HH:mm XXX", { timeZone: "Europe/Bucharest" }))
            .toEqual("2014-10-22 15:49 +03:00");
    });

    it("formats a date using defaults when params are not recognized", () => {
        expect(fmtDate(testDate, "Pp", { locale: "xxx" }))
            .toEqual("10/22/2014, 12:49 PM");
    });
});

describe("fmtNow", () => {
    beforeAll(() => {
        jest.useFakeTimers()
            .setSystemTime(testDate);
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    it("formats now when no custom formatting is passed", () => {
        expect(fmtNow("yyyy-MM-dd"))
            .toEqual("2014-10-22");
    });

    it("formats now when custom locale is passed", () => {
        expect(fmtNow("EEEE, yyyy-MM-dd", { locale: "ro" }))
            .toEqual("miercuri, 2014-10-22");
    });

    it("formats now when custom timezone is passed", () => {
        expect(fmtNow("yyyy-MM-dd HH:mm XXX", { timeZone: "Europe/Bucharest" }))
            .toEqual("2014-10-22 15:49 +03:00");
    });

    it("formats now using defaults when params are not recognized", () => {
        expect(fmtNow("Pp", { locale: "xxx" }))
            .toEqual("10/22/2014, 12:49 PM");
    });
});

describe("fmtDateRelative", () => {
    beforeAll(() => jest.useFakeTimers().setSystemTime(new Date("2024-01-31T00:00:00.000Z")));
    afterAll(() => jest.useRealTimers());

    it("formats date in past without suffix", () => {
        expect(fmtDateTimeRelative(new Date("2024-01-01")))
            .toEqual("about 1 month");
    });

    it("formats date in past with suffix", () => {
        expect(fmtDateTimeRelative(new Date("2024-01-01"), { addSuffix: true }))
            .toEqual("about 1 month ago");
    });

    it("formats date in past with suffix in Dutch", () => {
        expect(fmtDateTimeRelative(new Date("2024-01-01"), { addSuffix: true, locale: "nl" }))
            .toEqual("ongeveer 1 maand geleden");
    });

    it("formats date in past (strict) without suffix", () => {
        expect(fmtDateTimeRelative(new Date("2024-01-01"), { strict: true }))
            .toEqual("1 month");
    });

    it("formats date in future without suffix", () => {
        expect(fmtDateTimeRelative(new Date("2024-02-07")))
            .toEqual("7 days");
    });

    it("formats date in future with suffix", () => {
        expect(fmtDateTimeRelative(new Date("2024-02-07"), { addSuffix: true }))
            .toEqual("in 7 days");
    });

    it("formats date in future with suffix in French", () => {
        expect(fmtDateTimeRelative(new Date("2024-02-07"), { addSuffix: true, locale: "fr" }))
            .toEqual("dans 7 jours");
    });

    it("formats date in past with minute granularity by default", () => {
        expect(fmtDateTimeRelative(new Date("2024-01-30T23:59:48.000Z"), { addSuffix: true }))
            .toEqual("less than a minute ago");
    });

    it("formats date in past with minute granularity by when requested", () => {
        expect(fmtDateTimeRelative(new Date("2024-01-30T23:59:48.000Z"), { addSuffix: true, includeSeconds: true }))
            .toEqual("less than 20 seconds ago");
    })
});

describe("fmtDateWritten", () => {
    it("formats date with default locale", () => {
        expect(fmtDateWritten(new Date("2024-01-01")))
            .toEqual("January 1, 2024");
    });

    it("formats date in English (default)", () => {
        expect(fmtDateWritten(new Date("2024-01-01"), "en"))
            .toEqual("January 1, 2024");
    });

    it("formats date in English (GB)", () => {
        expect(fmtDateWritten(new Date("2024-01-01"), "en-GB"))
            .toEqual("1 January 2024");
    });

    it("formats date in Dutch", () => {
        expect(fmtDateWritten(new Date("2024-01-01"), "nl"))
            .toEqual("1 januari 2024");
    });

    it("formats date in French", () => {
        expect(fmtDateWritten(new Date("2024-01-01"), "fr"))
            .toEqual("1 janvier 2024");
    });

    it("formats date in German", () => {
        expect(fmtDateWritten(new Date("2024-01-01"), "de"))
            .toEqual("1. Januar 2024");
    });
});

describe("fmtDateTimeWritten", () => {
    it("formats date & time with default locale", () => {
        expect(fmtDateTimeWritten(new Date("2024-01-01T16:20:00")))
            .toEqual("January 1, 2024 at 4:20 PM");
    });

    it("formats date & time in English (default)", () => {
        expect(fmtDateTimeWritten(new Date("2024-01-01T16:20:00"), "en"))
            .toEqual("January 1, 2024 at 4:20 PM");
    });

    it("formats date & time in English (GB)", () => {
        expect(fmtDateTimeWritten(new Date("2024-01-01T16:20:00"), "en-GB"))
            .toEqual("1 January 2024 at 16:20");
    });

    it("formats date & time in Dutch", () => {
        expect(fmtDateTimeWritten(new Date("2024-01-01T16:20:00"), "nl"))
            .toEqual("1 januari 2024 om 16:20");
    });

    it("formats date & time in French", () => {
        expect(fmtDateTimeWritten(new Date("2024-01-01T16:20:00"), "fr"))
            .toEqual("1 janvier 2024 à 16:20");
    });

    it("formats date & time in German", () => {
        expect(fmtDateTimeWritten(new Date("2024-01-01T16:20:00"), "de"))
            .toEqual("1. Januar 2024 um 16:20");
    });
});

describe("fmtDateIso8601", () => {
    it("formats date as yyyy-MM-dd", () => {
        expect(fmtDateIso8601(new Date("2024-01-31")))
            .toEqual("2024-01-31");
    })
});

describe("fmtDateIso8601TZ", () => {
    it("is fmtDateIso8601 with timezone", () => {
        const date = new Date("2024-01-31T23:01Z");
        expect(fmtDateIso8601TZ(date))
            .toEqual(fmtDateIso8601(date, { timeZone: detectTimeZone() }));
    })
});

describe("fmtDateIso8601TimeLocalized", () => {
    it("formats date & time as yyyy-MM-dd p", () => {
        expect(fmtDateIso8601TimeLocalized(new Date("2024-01-31T16:20:00.000Z")))
            .toEqual("2024-01-31 4:20 PM");
    })

    it("formats date & time as yyyy-MM-dd p with NL locale", () => {
        expect(fmtDateIso8601TimeLocalized(new Date("2024-01-31T16:20:00.000Z"), { locale: "nl" }))
            .toEqual("2024-01-31 16:20");
    })
});

describe("fmtDateIso8601TZ", () => {
    it("is fmtDateIso8601TimeLocalized with timezone", () => {
        const date = new Date("2024-01-31T23:01Z");
        expect(fmtDateIso8601TimeLocalizedTZ(date))
            .toEqual(fmtDateIso8601TimeLocalized(date, { timeZone: detectTimeZone() }));
    })
});

describe("toTimeZoneCode", () => {
    it("returns the correct time zone", () => {
        expect(toTimeZoneCode(testDate, "Europe/Bucharest"))
            .toEqual("EEST");
        expect(toTimeZoneCode(sub(testDate, { months: 9 }), "Europe/Bucharest"))
            .toEqual("EET");
        expect(toTimeZoneCode(testDate, "America/New_York"))
            .toEqual("EDT");
    });
});

describe("parseDateFromString", () => {
    it("parses a correctly formatted date", () => {
        expect(parseDateFromString(testDate.toISOString()))
            .toEqual(testDate);

        const partialDate = new Date("2014-10-22")
        expect(parseDateFromString(partialDate.toISOString()))
            .toEqual(partialDate);
    });

    it("return null for incorrect dates", () => {
        expect(parseDateFromString(null))
            .toBeNull();
        expect(parseDateFromString(""))
            .toBeNull();
        expect(parseDateFromString("asdf"))
            .toBeNull();
        expect(parseDateFromString("2000 11 11"))
            .toBeNull();
    })
});

describe("sorting dates", () => {
    it("sorts ascending", () => {
        const dates = [
            new Date(2024, 12, 1),
            new Date(2024, 1, 1),
            new Date(2024, 1, 31),
            new Date(2024, 1, 1),
        ];
        expect(dates.sort(dateSorterAsc)).toEqual([
            new Date(2024, 1, 1),
            new Date(2024, 1, 1),
            new Date(2024, 1, 31),
            new Date(2024, 12, 1),
        ])
    });
    it("sorts ascending with nulls", () => {
        const dates = [
            new Date(2024, 12, 1),
            null,
            new Date(2024, 1, 1),
            new Date(2024, 1, 31),
            new Date(2024, 1, 1),
        ];
        expect(dates.sort(dateSorterAsc)).toEqual([
            null,
            new Date(2024, 1, 1),
            new Date(2024, 1, 1),
            new Date(2024, 1, 31),
            new Date(2024, 12, 1),
        ])
    });
    it("sorts descending", () => {
        const dates = [
            new Date(2024, 12, 1),
            new Date(2024, 1, 1),
            new Date(2024, 1, 31),
            new Date(2024, 1, 1),
        ];
        expect(dates.sort(dateSorterDesc)).toEqual([
            new Date(2024, 12, 1),
            new Date(2024, 1, 31),
            new Date(2024, 1, 1),
            new Date(2024, 1, 1),
        ])
    })
    it("sorts descending with nulls", () => {
        const dates = [
            new Date(2024, 12, 1),
            null,
            new Date(2024, 1, 1),
            new Date(2024, 1, 31),
            new Date(2024, 1, 1),
        ];
        expect(dates.sort(dateSorterDesc)).toEqual([
            new Date(2024, 12, 1),
            new Date(2024, 1, 31),
            new Date(2024, 1, 1),
            new Date(2024, 1, 1),
            null,
        ])
    })
});

describe("sorting arrays based on date property", () => {
    it("sorts asc when order is ASC or not provided", () => {
        const objectsWithDate = [
            { date: new Date(2024, 12, 1) },
            { date: null },
            { date: new Date(2024, 1, 1) },
            { date: new Date(2024, 1, 31) },
            { date: new Date(2024, 1, 1) },
        ];
        const expectedSortedArray = [
            { date: null },
            { date: new Date(2024, 1, 1) },
            { date: new Date(2024, 1, 1) },
            { date: new Date(2024, 1, 31) },
            { date: new Date(2024, 12, 1) },
        ];
        expect(sortByDate(objectsWithDate, o => o.date))
            .toEqual(expectedSortedArray);
        expect(sortByDate(objectsWithDate, o => o.date, SortOrder.ASC))
            .toEqual(expectedSortedArray);
    });

    it("sorts desc when order is DESC", () => {
        const objectsWithDate = [
            { date: new Date(2024, 12, 1) },
            { date: null },
            { date: new Date(2024, 1, 1) },
            { date: new Date(2024, 1, 31) },
            { date: new Date(2024, 1, 1) },
        ];
        const expectedSortedArray = [
            { date: new Date(2024, 12, 1) },
            { date: new Date(2024, 1, 31) },
            { date: new Date(2024, 1, 1) },
            { date: new Date(2024, 1, 1) },
            { date: null },
        ];
        expect(sortByDate(objectsWithDate, o => o.date, SortOrder.DESC))
            .toEqual(expectedSortedArray);
    });

    it("throws when either the elements array or extractor is undefined", () => {
        expect(() => sortByDate(null, (o: Date) => o))
            .toThrow(new Error("Both elements & dateExtractor have to be defined"));
        expect(() => sortByDate(undefined, (o: Date) => o))
            .toThrow(new Error("Both elements & dateExtractor have to be defined"));
        expect(() => sortByDate([], null))
            .toThrow(new Error("Both elements & dateExtractor have to be defined"));
        expect(() => sortByDate([], undefined))
            .toThrow(new Error("Both elements & dateExtractor have to be defined"));
    })
});

describe("moment -> datefns validation tests", () => {
    it("formats correctly the dates", () => {
        const beforeNewYear = new Date("2000-12-31T23:59:59");
        const afterNewYear = new Date("2000-01-01T01:01:01");
        const now = new Date();

        expect(moment(now).format("YYYYMMDD"))
            .toEqual(fmtDate(now, "yyyyMMdd"));

        expect(new Date(moment.utc(now).format()).toISOString())  // moment.format strips off milliseconds
            .toEqual(setMilliseconds(now, 0).toISOString());

        expect(moment.unix(now.getTime()).toISOString())
            .toEqual(fromUnixTime(now.getTime()).toISOString());

        const validate = (date: Date) => {
            expect(moment(date).format("YYYY-MM-DD"))
                .toEqual( fmtDateIso8601TZ(date));

            expect(moment(date).format("yyyy-MM-DD-HH"))
                .toEqual(fmtDate(date, "yyyy-MM-dd-HH", { timeZone: detectTimeZone() }));

            expect(moment(date).format("MMM Y"))
                .toEqual(fmtDate(date, "MMM y", { timeZone: detectTimeZone() }));

            expect(moment(date).format("MMM D"))
                .toEqual(fmtDate(date, "MMM d", { timeZone: detectTimeZone() }));

            expect(moment(date).format("HH:mm"))
                .toEqual(fmtDate(date, "HH:mm", { timeZone: detectTimeZone() }));

            expect(moment(date).format("YYYY-MM-DD HH:mm"))
                .toEqual(fmtDate(date, "yyyy-MM-dd HH:mm", { timeZone: detectTimeZone() }))

            expect(moment(date).format("DD/MM/YYYY HH:mm"))
                .toEqual(fmtDate(date, "dd/MM/yyyy HH:mm", { timeZone: detectTimeZone() }))

            expect(moment(date).format("MM/YYYY"))
                .toEqual(fmtDate(date, "MM/yyyy", { timeZone: detectTimeZone() }))

            expect(moment(date).format("x"))
                .toEqual(date.getTime().toString());

            expect(parse(fmtDate(date, "dd/MM/yyyy"), "dd/MM/yyyy", new Date()).toISOString())
                .toEqual(startOfDay(date).toISOString());
        };

        [beforeNewYear, afterNewYear, now].forEach(validate);
    });
});
