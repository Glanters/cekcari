import { configApp } from '@adonisjs/eslint-config'

// File names use PascalCase (classes) and camelCase (views, scripts) instead of snake_case.
export default configApp({ rules: { '@unicorn/filename-case': 'off' } })
