import type messages from '../locales/en.json'
import { createTranslator } from '@/lib/i18n'

/** Translation functions for this extension's strings plus the shared ones (see src/lib/i18n.ts). */
export const { t, tPlural, tRich } = createTranslator<keyof typeof messages>()
