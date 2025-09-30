import { HintState, useScrollHint } from "../../../src/views/reader/ScrollHint/useScrollHint";
import { act, renderHook } from "@testing-library/react-hooks";

const LOCAL_STORAGE_KEY = "scroll-hint-state";

describe("useScrollHint", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        localStorage.clear();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    it("updates isVisible flag based on hintState changes", () => {
        const { result } = renderHook(() => useScrollHint(0));
        expect(result.current.isVisible).toBe(false);
        act(() => { jest.advanceTimersByTime(7_900); });
        expect(result.current.hintState).toBe(HintState.FirstTimeVisible);
        expect(result.current.isVisible).toBe(true);
        act(() => { jest.advanceTimersByTime(4_100); });
        expect(result.current.hintState).toBe(HintState.FirstTimeHiddenIgnored);
        expect(result.current.isVisible).toBe(false);
    });

    it("transitions from FirstTimeVisible to FirstTimeHiddenIgnored after inactivity", () => {
        const { result } = renderHook(() => useScrollHint(0));
        act(() => { jest.advanceTimersByTime(7_100); });
        expect(result.current.hintState).toBe(HintState.FirstTimeVisible);
        act(() => { jest.advanceTimersByTime(4_100); });
        expect(result.current.hintState).toBe(HintState.FirstTimeHiddenIgnored);
    });

    it("transitions from FirstTimeHiddenIgnored to SecondTimeVisible after inactivity", () => {
        const { result } = renderHook(() => useScrollHint(0));
        act(() => { jest.advanceTimersByTime(7_100); }); // FirstTimeVisible
        act(() => { jest.advanceTimersByTime(4_100); }); // FirstTimeHiddenIgnored
        expect(result.current.hintState).toBe(HintState.FirstTimeHiddenIgnored);
        act(() => { jest.advanceTimersByTime(10_100); });
        expect(result.current.hintState).toBe(HintState.SecondTimeVisible);
    });

    it("transitions from SecondTimeVisible to SecondTimeHiddenIgnored after inactivity", () => {
        const { result } = renderHook(() => useScrollHint(0));
        act(() => { jest.advanceTimersByTime(7_100); }); // FirstTimeVisible
        act(() => { jest.advanceTimersByTime(4_100); }); // FirstTimeHiddenIgnored
        act(() => { jest.advanceTimersByTime(10_100); }); // SecondTimeVisible
        expect(result.current.hintState).toBe(HintState.SecondTimeVisible);
        act(() => { jest.advanceTimersByTime(4_100); });
        expect(result.current.hintState).toBe(HintState.SecondTimeHiddenIgnored);
    });

    it("handles onFocus event in InitiallyHiddenNotSeen state", () => {
        const { result } = renderHook(() => useScrollHint(0));
        expect(result.current.hintState).toBe(HintState.InitiallyHiddenNotSeen);
        act(() => { result.current.onFocus(); });
        expect(result.current.hintState).toBe(HintState.InitiallyHiddenAfterInteraction);
        expect(localStorage.getItem(LOCAL_STORAGE_KEY)).toBe(HintState.InitiallyHiddenAfterInteraction);
    });

    it("handles onFocus event in FirstTimeVisible state", () => {
        const { result } = renderHook(() => useScrollHint(0));
        act(() => { jest.advanceTimersByTime(7_100); });
        expect(result.current.hintState).toBe(HintState.FirstTimeVisible);
        act(() => { result.current.onFocus(); });
        expect(result.current.hintState).toBe(HintState.FirstTimeHiddenAfterInteraction);
        expect(localStorage.getItem(LOCAL_STORAGE_KEY)).toBe(HintState.FirstTimeHiddenAfterInteraction);
    });

    it("handles onFocus event in FirstTimeHiddenIgnored state", () => {
        const { result } = renderHook(() => useScrollHint(0));
        act(() => { jest.advanceTimersByTime(7_100); });
        act(() => { jest.advanceTimersByTime(4_100); });
        expect(result.current.hintState).toBe(HintState.FirstTimeHiddenIgnored);
        act(() => { result.current.onFocus(); });
        expect(result.current.hintState).toBe(HintState.SecondTimeHiddenAfterInteraction);
        expect(localStorage.getItem(LOCAL_STORAGE_KEY)).toBe(HintState.SecondTimeHiddenAfterInteraction);
    });

    it("handles onFocus event in SecondTimeVisible state", () => {
        const { result } = renderHook(() => useScrollHint(0));
        act(() => { jest.advanceTimersByTime(7_100); });  // FirstTimeVisible
        act(() => { jest.advanceTimersByTime(4_100); });  // FirstTimeHiddenIgnored
        act(() => { jest.advanceTimersByTime(10_100); }); // SecondTimeVisible
        expect(result.current.hintState).toBe(HintState.SecondTimeVisible);
        act(() => { result.current.onFocus(); });
        expect(result.current.hintState).toBe(HintState.SecondTimeHiddenAfterInteraction);
        expect(localStorage.getItem(LOCAL_STORAGE_KEY)).toBe(HintState.SecondTimeHiddenAfterInteraction);
    });

    it("initializes state with localStorage value when it is a seen hint", () => {
        localStorage.setItem(LOCAL_STORAGE_KEY, HintState.InitiallyHiddenAfterInteraction);
        const { result } = renderHook(() => useScrollHint(0));
        expect(result.current.hintState).toBe(HintState.InitiallyHiddenSeenBefore);
    });

    it("does not schedule timers for states without timeouts", () => {
        localStorage.setItem(LOCAL_STORAGE_KEY, HintState.InitiallyHiddenAfterInteraction);
        const { result } = renderHook(() => useScrollHint(0));
        act(() => { jest.advanceTimersByTime(20_000); });
        expect(result.current.hintState).toBe(HintState.InitiallyHiddenSeenBefore);
    });

    it("does not listen to chunk index changes during the first 2 seconds", () => {
        const { result, rerender } = renderHook(
            ({ index }) => useScrollHint(index),
            { initialProps: { index: 0 } }
        );
        act(() => { rerender({ index: 1 }); });
        expect(result.current.hintState).toBe(HintState.InitiallyHiddenNotSeen);
        act(() => { jest.advanceTimersByTime(2_000); });
        expect(result.current.hintState).toBe(HintState.InitiallyHiddenNotSeen);
    });

    it("listens to chunk index changes after 2 seconds", () => {
        const { result, rerender } = renderHook(
            ({ index }) => useScrollHint(index),
            { initialProps: { index: 0 } }
        );
        act(() => { jest.advanceTimersByTime(2_100); });
        act(() => { rerender({ index: 1 }); });
        expect(result.current.hintState).toBe(HintState.InitiallyHiddenAfterInteraction);
    });

});
