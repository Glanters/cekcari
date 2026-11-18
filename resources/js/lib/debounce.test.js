import { afterEach, describe, expect, it, vi } from 'vitest';
import { debounce } from './debounce';

describe('debounce', () => {
    afterEach(() => vi.useRealTimers());

    it('hanya menjalankan panggilan terakhir setelah jeda', () => {
        vi.useFakeTimers();
        const callback = vi.fn();
        const debounced = debounce(callback, 200);

        debounced('k');
        debounced('ko');
        debounced('kop');
        vi.advanceTimersByTime(199);
        expect(callback).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(callback).toHaveBeenCalledOnce();
        expect(callback).toHaveBeenCalledWith('kop');
    });

    it('cancel membatalkan panggilan yang tertunda', () => {
        vi.useFakeTimers();
        const callback = vi.fn();
        const debounced = debounce(callback, 200);

        debounced('kopi');
        debounced.cancel();
        vi.advanceTimersByTime(500);

        expect(callback).not.toHaveBeenCalled();
    });
});
