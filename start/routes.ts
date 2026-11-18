/**
 * Rute dibagi per modul; setiap berkas mengikat rutenya ke domain pencarian atau domain panel.
 */
import '#start/routes/search'
import '#start/routes/panel_auth'
import '#start/routes/panel_domains'
import '#start/routes/panel_admin'
import '#start/routes/pages'

import router from '@adonisjs/core/services/router'

// Cek kesehatan untuk load balancer/monitor.
router.get('/up', ({ response }) => response.ok({ status: 'ok' }))
