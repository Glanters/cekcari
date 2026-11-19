/**
 * Memecah teks bersorot dari server menjadi potongan biasa dan potongan yang disorot,
 * sehingga bisa dirender sebagai teks Vue biasa tanpa v-html (aman dari XSS).
 */
export function splitHighlightedText(text, startMarker, endMarker) {
    if (!text) {
        return [];
    }

    const segments = [];
    let cursor = 0;

    while (cursor < text.length) {
        const startIndex = text.indexOf(startMarker, cursor);

        if (startIndex === -1) {
            segments.push({ text: text.slice(cursor), isHighlighted: false });
            break;
        }

        const endIndex = text.indexOf(endMarker, startIndex + startMarker.length);

        if (endIndex === -1) {
            segments.push({ text: text.slice(cursor).replaceAll(startMarker, ''), isHighlighted: false });
            break;
        }

        if (startIndex > cursor) {
            segments.push({ text: text.slice(cursor, startIndex), isHighlighted: false });
        }

        segments.push({ text: text.slice(startIndex + startMarker.length, endIndex), isHighlighted: true });
        cursor = endIndex + endMarker.length;
    }

    return mergeAdjacentSegments(segments.filter((segment) => segment.text !== ''));
}

function mergeAdjacentSegments(segments) {
    return segments.reduce((merged, segment) => {
        const previous = merged.at(-1);

        if (previous && previous.isHighlighted === segment.isHighlighted) {
            previous.text += segment.text;
        } else {
            merged.push({ ...segment });
        }

        return merged;
    }, []);
}
