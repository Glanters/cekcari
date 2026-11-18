/**
 * Pola LIKE/ILIKE yang aman: karakter %, _, dan \ dari masukan pengguna diperlakukan sebagai teks biasa.
 */
function escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

export function containsPattern(value: string): string {
    return `%${escapeLike(value)}%`
}
