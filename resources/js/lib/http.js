import axios from 'axios';

// Satu instance untuk seluruh panggilan API agar cookie sesi & token CSRF selalu ikut terkirim.
const http = axios.create({
    baseURL: '/api/v1',
    withCredentials: true,
    withXSRFToken: true,
    headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    },
});

// Server memutus sesi dengan 403 + alasan ini (akun dinonaktifkan atau IP di luar whitelist).
const SESSION_ENDED_REASONS = ['account_inactive', 'ip_not_allowed'];

let unauthorizedHandler = null;

export function onUnauthorized(handler) {
    unauthorizedHandler = handler;
}

export function isSessionEnded(error) {
    const reason = error?.response?.data?.errors?.reason?.[0];

    return error?.response?.status === 403 && SESSION_ENDED_REASONS.includes(reason);
}

http.interceptors.response.use(
    (response) => response,
    (error) => {
        if (unauthorizedHandler && error.response?.status === 401) {
            unauthorizedHandler('');
        } else if (unauthorizedHandler && isSessionEnded(error)) {
            unauthorizedHandler(error.response.data.message);
        }

        return Promise.reject(error);
    },
);

// Server menyetel cookie XSRF-TOKEN di setiap jawaban; endpoint ini dipanggil sebelum login agar cookie-nya sudah ada.
export async function ensureCsrfCookie() {
    await http.get('/csrf-token');
}

export default http;
