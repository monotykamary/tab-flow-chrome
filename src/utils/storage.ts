import type { Settings, TabRule, Workspace } from '@/types'

const STORAGE_KEYS = {
  SETTINGS: 'settings',
  WORKSPACES: 'workspaces',
  ACTIVE_WORKSPACE: 'activeWorkspace',
  TAB_RULES: 'tabRules',
  TAB_STATS: 'tabStats',
  ARCHIVED_TABS: 'archivedTabs',
  PREVIOUS_TAB_ID: 'previousTabId',
} as const

export const storage = {
  async getSettings(): Promise<Settings> {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS)
    const stored = result[STORAGE_KEYS.SETTINGS]
    if (!stored) {
      return getDefaultSettings()
    }
    // Merge with defaults to ensure new fields are included
    return { ...getDefaultSettings(), ...stored }
  },

  async setSettings(settings: Partial<Settings>): Promise<void> {
    const current = await this.getSettings()
    await chrome.storage.sync.set({
      [STORAGE_KEYS.SETTINGS]: { ...current, ...settings }
    })
  },

  async getWorkspaces(): Promise<Workspace[]> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.WORKSPACES)
    return result[STORAGE_KEYS.WORKSPACES] || []
  },

  async saveWorkspace(workspace: Workspace): Promise<void> {
    const workspaces = await this.getWorkspaces()
    const index = workspaces.findIndex(w => w.id === workspace.id)
    
    if (index >= 0) {
      workspaces[index] = workspace
    } else {
      workspaces.push(workspace)
    }
    
    await chrome.storage.local.set({ [STORAGE_KEYS.WORKSPACES]: workspaces })
  },

  async saveOrUpdateWorkspaceByName(workspace: Workspace): Promise<void> {
    const workspaces = await this.getWorkspaces()
    const index = workspaces.findIndex(w => w.name === workspace.name)
    
    if (index >= 0) {
      // Update existing workspace with the same name
      workspaces[index] = {
        ...workspace,
        id: workspaces[index].id, // Keep the original ID
        createdAt: workspaces[index].createdAt // Keep original creation time
      }
    } else {
      workspaces.push(workspace)
    }
    
    await chrome.storage.local.set({ [STORAGE_KEYS.WORKSPACES]: workspaces })
  },

  async deleteWorkspace(id: string): Promise<void> {
    const workspaces = await this.getWorkspaces()
    const filtered = workspaces.filter(w => w.id !== id)
    await chrome.storage.local.set({ [STORAGE_KEYS.WORKSPACES]: filtered })
  },

  async getActiveWorkspace(): Promise<string | null> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_WORKSPACE)
    return result[STORAGE_KEYS.ACTIVE_WORKSPACE] ?? null
  },

  async setActiveWorkspace(id: string | null): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.ACTIVE_WORKSPACE]: id })
  },

  async getTabRules(): Promise<TabRule[]> {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.TAB_RULES)
    return result[STORAGE_KEYS.TAB_RULES] || []
  },

  async saveTabRule(rule: TabRule): Promise<void> {
    const rules = await this.getTabRules()
    const index = rules.findIndex(r => r.id === rule.id)
    
    if (index >= 0) {
      rules[index] = rule
    } else {
      rules.push(rule)
    }
    
    await chrome.storage.sync.set({ [STORAGE_KEYS.TAB_RULES]: rules })
  },

  async deleteTabRule(id: string): Promise<void> {
    const rules = await this.getTabRules()
    const filtered = rules.filter(r => r.id !== id)
    await chrome.storage.sync.set({ [STORAGE_KEYS.TAB_RULES]: filtered })
  },

  async getPreviousTabId(): Promise<number | null> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.PREVIOUS_TAB_ID)
    return result[STORAGE_KEYS.PREVIOUS_TAB_ID] ?? null
  },

  async setPreviousTabId(tabId: number | null): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.PREVIOUS_TAB_ID]: tabId })
  },
}

function getDefaultSettings(): Settings {
  return {
    theme: 'system',
    autoArchiveEnabled: false,
    autoArchiveMinutes: 30,
    duplicateDetection: true,
    memorySaverEnabled: true,
    memorySaverThresholdMB: 500,
    memorySaverExcludedDomains: [],
    dailyCleanupEnabled: false,
    dailyCleanupTime: '22:00',
    tabLimitEnabled: false,
    tabLimitCount: 50,
    accentColor: 'blue',
    autoCollapseGroups: false,
    autoCollapseDelay: 5,
    copyUrlShortcutEnabled: true,
  }
}