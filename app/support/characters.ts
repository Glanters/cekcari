/**
 * Batas panjang dihitung per karakter (code point), bukan per unit UTF-16, supaya emoji
 * dan huruf di luar BMP tidak terpotong di tengah.
 */
export function sliceChars(value: string, length: number): string {
    return value.length <= length ? value : Array.from(value).slice(0, length).join('')
}

export function countChars(value: string): number {
    return Array.from(value).length
}
