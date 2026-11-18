export function debounce(callback, waitMs) {
    let timerId = null;

    const debounced = (...args) => {
        clearTimeout(timerId);
        timerId = setTimeout(() => callback(...args), waitMs);
    };

    debounced.cancel = () => clearTimeout(timerId);

    return debounced;
}
