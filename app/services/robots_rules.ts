type RobotsRule = { pattern: string; isAllowed: boolean }

type RobotsGroup = { agents: string[]; rules: RobotsRule[] }

/**
 * Aturan robots.txt yang berlaku untuk crawler ini (grup "*" atau grup dengan nama bot kita).
 * Aturan paling spesifik (pola terpanjang) yang menang, sesuai RFC 9309.
 */
export default class RobotsRules {
    private constructor(private readonly rules: RobotsRule[]) {}

    static allowAll(): RobotsRules {
        return new RobotsRules([])
    }

    static parse(robotsTxt: string, userAgent: string): RobotsRules {
        const botName = (
            userAgent.split('/').find((part) => part !== '') ?? userAgent
        ).toLowerCase()
        const specificRules: RobotsRule[] = []
        const wildcardRules: RobotsRule[] = []

        for (const group of RobotsRules.groupLines(robotsTxt)) {
            if (group.agents.includes(botName)) {
                specificRules.push(...group.rules)
            } else if (group.agents.includes('*')) {
                wildcardRules.push(...group.rules)
            }
        }

        return new RobotsRules(specificRules.length > 0 ? specificRules : wildcardRules)
    }

    isAllowed(url: string): boolean {
        const parsed = URL.parse(url)
        const path = (parsed?.pathname || '/') + (parsed?.search ?? '')
        let bestMatchLength = -1
        let isAllowed = true

        for (const rule of this.rules) {
            if (!this.matches(rule.pattern, path)) {
                continue
            }

            const length = Buffer.byteLength(rule.pattern)

            if (length > bestMatchLength || (length === bestMatchLength && rule.isAllowed)) {
                bestMatchLength = length
                isAllowed = rule.isAllowed
            }
        }

        return isAllowed
    }

    // "*" cocok dengan karakter apa pun; "$" di akhir pola berarti path harus berakhir di situ.
    private matches(pattern: string, path: string): boolean {
        const isAnchoredEnd = pattern.endsWith('$')
        const body = isAnchoredEnd ? pattern.slice(0, -1) : pattern
        const regex = body
            .split('*')
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('.*')

        return new RegExp(`^${regex}${isAnchoredEnd ? '$' : ''}`).test(path)
    }

    private static groupLines(robotsTxt: string): RobotsGroup[] {
        const groups: RobotsGroup[] = []
        let current: RobotsGroup | null = null
        let isReadingAgents = false

        for (const rawLine of robotsTxt.split(/\r\n|\r|\n/)) {
            const line = rawLine.replace(/#.*$/, '').trim()
            const separatorIndex = line.indexOf(':')

            if (separatorIndex === -1) {
                continue
            }

            const field = line.slice(0, separatorIndex).trim().toLowerCase()
            const value = line.slice(separatorIndex + 1).trim()

            if (field === 'user-agent') {
                // Baris User-agent berurutan membentuk satu grup yang sama.
                if (!isReadingAgents || current === null) {
                    current = { agents: [], rules: [] }
                    groups.push(current)
                }

                current.agents.push(value.toLowerCase())
                isReadingAgents = true

                continue
            }

            isReadingAgents = false

            if (current === null || !['allow', 'disallow'].includes(field) || value === '') {
                continue
            }

            current.rules.push({ pattern: value, isAllowed: field === 'allow' })
        }

        return groups
    }
}
