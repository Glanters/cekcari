const NETWORK_ERROR_MESSAGE = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda lalu coba lagi.';
const UNKNOWN_ERROR_MESSAGE = 'Terjadi kesalahan. Silakan coba lagi.';

/**
 * Pesan yang aman ditampilkan ke pengguna; server sudah mengirim pesan berbahasa Indonesia
 * dalam format standar, jadi detail teknis axios tidak pernah diteruskan.
 */
export function getErrorMessage(error) {
    if (!error?.response) {
        return NETWORK_ERROR_MESSAGE;
    }

    return error.response.data?.message || UNKNOWN_ERROR_MESSAGE;
}

/**
 * Mengubah errors Laravel ({ field: [pesan] }) menjadi { field: pesan } untuk VeeValidate.
 * Kunci bertitik seperti "tags.0" digabung ke field induknya.
 */
export function getFieldErrors(error) {
    const serverErrors = error?.response?.status === 422 ? error.response.data?.errors ?? {} : {};
    const fieldErrors = {};

    for (const [key, messages] of Object.entries(serverErrors)) {
        const fieldName = key.split('.')[0];

        if (!fieldErrors[fieldName] && Array.isArray(messages) && messages.length > 0) {
            fieldErrors[fieldName] = messages[0];
        }
    }

    return fieldErrors;
}
