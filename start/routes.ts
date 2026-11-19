/**
 * Rute dibagi per modul; setiap berkas mengikat rutenya ke domain pencarian atau domain panel.
 */
import '#start/routes/search'
import '#start/routes/panelAuth'
import '#start/routes/panelDomains'
import '#start/routes/panelAdmin'
import '#start/routes/panelStatistics'
import '#start/routes/pages'

import router from '@adonisjs/core/services/router'
import { domains } from '#config/cekcari'

// Cek kesehatan untuk load balancer/monitor. Didaftarkan per domain karena rute yang terikat domain
// tidak pernah jatuh ke rute tanpa domain.
for (const host of [domains.search, domains.panel]) {
    router
        .get('/up', ({ response }) => response.ok({ status: 'ok' }))
        .domain(host)
        .as(`health.${host}`)
}
