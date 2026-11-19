import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

const BATCH_SIZE = 50

/**
 * Sekali jalan setelah urutan ikon diubah (favicon lebih dulu dari apple-touch-icon): logo semua
 * situs aktif dibaca ulang sekarang, tanpa menunggu crawl mingguan. Hanya halaman utama dan ikonnya
 * yang diambil, jadi jauh lebih ringan dari crawl penuh.
 */
export default class DomainsRefreshIcons extends BaseCommand {
    static commandName = 'domains:refresh-icons'
    static description = 'Baca ulang favicon semua situs aktif sekarang'

    static options: CommandOptions = { startApp: true }

    async run() {
        const { default: app } = await import('@adonisjs/core/services/app')
        const { default: Domain } = await import('#models/domain')
        const { default: DomainService } = await import('#services/domain_service')

        const domainService = await app.container.make(DomainService)
        let lastId = 0
        let checkedCount = 0
        let changedCount = 0

        while (true) {
            const domains = await Domain.query()
                .withScopes((scopes) => scopes.active())
                .where('id', '>', lastId)
                .orderBy('id')
                .limit(BATCH_SIZE)

            if (domains.length === 0) {
                break
            }

            for (const domain of domains) {
                if (await domainService.refreshIcon(domain)) {
                    changedCount++
                }

                checkedCount++
                lastId = domain.id
            }

            this.logger.info(`${checkedCount} situs diperiksa, ${changedCount} logo diperbarui…`)
        }

        this.logger.success(
            `Selesai: ${checkedCount} situs diperiksa, ${changedCount} logo diperbarui.`
        )
    }
}
