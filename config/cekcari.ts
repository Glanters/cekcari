import env from '#start/env'

/**
 * Pengaturan khusus CekCari. Nilai rahasia tetap hanya dibaca dari .env.
 */
export const domains = {
    search: env.get('SEARCH_DOMAIN'),
    panel: env.get('PANEL_DOMAIN'),
}

export const seo = {
    siteName: 'CekCari',
    searchUrl: env.get('SEARCH_URL').replace(/\/+$/, ''),
    defaultTitle: 'CekCari — Mesin Pencari Situs dan Halaman Web Indonesia',
    defaultDescription:
        'Cari situs dan halaman web Indonesia dengan cepat di CekCari. Ketik kata kunci, temukan situs yang relevan beserta halaman-halaman di dalamnya.',
    imagePath: '/images/brand/cekcari-logo-512.png',
    googleSiteVerification: env.get('GOOGLE_SITE_VERIFICATION') ?? '',
    isIndexingAllowed: env.get('SEO_ALLOW_INDEXING') ?? true,
}

export const crawler = {
    maxPages: env.get('CRAWLER_MAX_PAGES') ?? 50,
    userAgent: env.get('CRAWLER_USER_AGENT') ?? 'CekCariBot/1.0',
    timeoutSeconds: 10,
    maxRedirects: 3,
    maxBytes: 2 * 1024 * 1024,
    maxContentChars: 20000,
    delayMs: env.get('CRAWLER_DELAY_MS') ?? 500,
    maxLogoBytes: 512 * 1024,
}


export const accountCenter = {
    driver: env.get('ACCOUNTCENTER_DRIVER') ?? 'http',
    uri: env.get('ACCOUNTCENTER_URI') ?? '',
    name: env.get('ACCOUNTCENTER_NAME') ?? '',
    secret: env.get('ACCOUNTCENTER_SECRET'),
    timeoutMs: env.get('ACCOUNTCENTER_TIMEOUT_MS') ?? 8000,
    dummyPassword: env.get('ACCOUNTCENTER_DUMMY_PASSWORD'),
    isDummyAllowedInProduction: env.get('ACCOUNTCENTER_DUMMY_IN_PRODUCTION') ?? false,
    superadminEmails: env.get('ACCOUNTCENTER_SUPERADMIN_EMAILS') ?? '',
}
