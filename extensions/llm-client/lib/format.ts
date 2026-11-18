import { formatNumber } from '@/lib/i18n'
import { t, tPlural } from './i18n'

const KB = 1024
const MB = 1024 * KB
const GB = 1024 * MB

/** A number with a fixed count of decimals, e.g. 1.5 → "1.5" or "1,5". */
function decimals(value: number, digits: number): string {
  return formatNumber(value, { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false })
}

/** Token count such as "950" or "1.2k". */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) return t('thousands', decimals(tokens / 1000, 1))
  return formatNumber(tokens)
}

/** Estimated token count with its unit, e.g. "~950 tokens" or "~1.2k tokens". */
export function formatApproxTokens(tokens: number): string {
  return tokens >= 1000 ? t('approxTokensThousands', formatTokenCount(tokens)) : tPlural('approxTokens', tokens)
}

/** Size of an attached file, e.g. "512 B", "1.5 KB" or "2.3 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < KB) return t('sizeBytes', decimals(bytes, 0))
  if (bytes < MB) return t('sizeKilobytes', decimals(bytes / KB, 1))
  return t('sizeMegabytes', decimals(bytes / MB, 1))
}

/** Size of a model on disk, e.g. "640 MB" or "4.1 GB". */
export function formatModelSize(bytes: number): string {
  if (bytes < GB) return t('sizeMegabytes', decimals(bytes / MB, 0))
  return t('sizeGigabytes', decimals(bytes / GB, 1))
}
