/**
 * Store screenshot scenes per extension (directory name → scenes).
 * Each scene becomes one 1280x800 image in extensions/<slug>/screenshots/.
 */

import type { Scene } from './stage'
import { breakpointViewerScenes } from './scenes/breakpoint-viewer'
import { llmClientScenes } from './scenes/llm-client'
import { piholeManagerScenes } from './scenes/pihole-manager'
import { tableExtractorScenes } from './scenes/table-extractor'
import { websiteBlockerScenes } from './scenes/website-blocker'

export const SCENES: Record<string, Scene[]> = {
  'breakpoint-viewer': breakpointViewerScenes,
  'llm-client': llmClientScenes,
  'pihole-manager': piholeManagerScenes,
  'table-extractor': tableExtractorScenes,
  'website-blocker': websiteBlockerScenes,
}
