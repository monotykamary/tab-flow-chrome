import { storage } from './utils/storage'
import type { TabInfo, TabRule, RuleCondition, RuleAction, Workspace } from './types'

// Tab tracking
const tabLastAccessed = new Map<number, number>()
const tabTimeSpent = new Map<number, number>()
let activeTabId: number | null = null
let previousTabId: number | null = null
let lastActiveTime = Date.now()

// Initialize on install/update
chrome.runtime.onInstalled.addListener(() => {
  console.log('Tab Flow extension installed')
  initializeExtension()
})

// Initialize on startup (when Chrome starts or extension is re-enabled)
chrome.runtime.onStartup.addListener(() => {
  console.log('Tab Flow extension started')
  initializeExtension()
})

// Also initialize immediately when background script loads
// This helps during development when reloading the extension
initializeExtension().catch(console.error)

// Initialize automations
async function initializeExtension() {
  await setupAlarms()
  await reconcileSavedGroups()
  
  // Also check if we need to run any immediate tasks
  const settings = await storage.getSettings()
  if (settings.autoArchiveEnabled) {
    console.log('Auto-archive is enabled, checking for inactive tabs...')
  }
}

// Reconcile saved groups with active Chrome groups
async function reconcileSavedGroups() {
  try {
    const [activeGroups, workspaces] = await Promise.all([
      chrome.tabGroups.query({}),
      storage.getWorkspaces()
    ])
    
    // Update saved workspaces that have matching active groups
    for (const workspace of workspaces) {
      const activeGroup = activeGroups.find(g => g.title === workspace.name)
      
      if (activeGroup) {
        // This saved group is now active, update it with current state
        const tabs = await chrome.tabs.query({ groupId: activeGroup.id })
        
        const updatedWorkspace: Workspace = {
          ...workspace,
          groups: [{
            ...workspace.groups[0],
            id: `g_${activeGroup.id}`,
            color: activeGroup.color,
            collapsed: activeGroup.collapsed,
            tabs: tabs.map(t => t.id!),
            updatedAt: Date.now()
          }],
          tabs: tabs.map(t => ({ ...t })),
          updatedAt: Date.now()
        }
        
        await storage.saveOrUpdateWorkspaceByName(updatedWorkspace)
        console.log(`Updated saved group "${workspace.name}" with active group ID ${activeGroup.id}`)
      }
    }
  } catch (error) {
    console.error('Failed to reconcile saved groups:', error)
  }
}

// Listen for settings changes to update alarms
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'sync' && changes.settings) {
    console.log('Settings changed, updating alarms...')
    await setupAlarms()
  }
})

// Track tab activity
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // Update time spent for previous tab
  if (activeTabId !== null) {
    const timeSpent = Date.now() - lastActiveTime
    tabTimeSpent.set(activeTabId, (tabTimeSpent.get(activeTabId) || 0) + timeSpent)
    previousTabId = activeTabId
  }

  activeTabId = activeInfo.tabId
  lastActiveTime = Date.now()
  tabLastAccessed.set(activeInfo.tabId, Date.now())
})

// Track new tabs
chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.id) {
    tabLastAccessed.set(tab.id, Date.now())
    await applyRules(tab)
    await updateDailyStats('opened')
    await enforceTabLimits()
  }
})

// Track tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    await applyRules(tab)
    await checkDuplicates(tab)
  }
})

// Track tab removal
chrome.tabs.onRemoved.addListener(async (tabId) => {
  tabLastAccessed.delete(tabId)
  tabTimeSpent.delete(tabId)
  await updateDailyStats('closed')
})

// Track group updates
chrome.tabGroups.onUpdated.addListener(async (group) => {
  // Auto-save when a group is updated (renamed, color changed, etc.)
  if (group.title) {
    const tabs = await chrome.tabs.query({ groupId: group.id })
    const workspaces = await storage.getWorkspaces()
    const existingWorkspace = workspaces.find(ws => ws.name === group.title)
    
    if (existingWorkspace && tabs.length > 0) {
      // Update the existing saved workspace
      const updatedWorkspace: Workspace = {
        ...existingWorkspace,
        groups: [{
          ...existingWorkspace.groups[0],
          id: `g_${group.id}`,
          name: group.title,
          color: group.color,
          collapsed: group.collapsed,
          tabs: tabs.map(t => t.id!),
          updatedAt: Date.now()
        }],
        tabs: tabs.map(t => ({ ...t })),
        updatedAt: Date.now()
      }
      
      await storage.saveOrUpdateWorkspaceByName(updatedWorkspace)
    }
  }
})

// Setup alarms for scheduled tasks
async function setupAlarms() {
  const settings = await storage.getSettings()
  
  // Clear all existing alarms first to avoid duplicates
  await chrome.alarms.clearAll()
  console.log('Cleared all existing alarms')

  // Auto-archive alarm
  if (settings.autoArchiveEnabled) {
    chrome.alarms.create('autoArchive', { periodInMinutes: 5 })
    console.log('Created auto-archive alarm (every 5 minutes)')
  }

  // Daily cleanup alarm
  if (settings.dailyCleanupEnabled) {
    const [hours, minutes] = settings.dailyCleanupTime.split(':').map(Number)
    const now = new Date()
    const scheduledTime = new Date()
    scheduledTime.setHours(hours, minutes, 0, 0)

    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1)
    }

    const delayInMinutes = (scheduledTime.getTime() - now.getTime()) / (1000 * 60)
    chrome.alarms.create('dailyCleanup', {
      delayInMinutes,
      periodInMinutes: 24 * 60
    })
    console.log(`Created daily cleanup alarm for ${settings.dailyCleanupTime}`)
  }

  // Memory saver alarm - This only suspends tabs, doesn't archive them
  if (settings.memorySaverEnabled) {
    chrome.alarms.create('memorySaver', { periodInMinutes: 10 })
    console.log('Created memory saver alarm (every 10 minutes)')
  }
}

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  switch (alarm.name) {
    case 'autoArchive':
      await autoArchiveInactiveTabs()
      break
    case 'dailyCleanup':
      await performDailyCleanup()
      break
    case 'memorySaver':
      await suspendMemoryHeavyTabs()
      break
  }
})

// Auto-archive inactive tabs
async function autoArchiveInactiveTabs() {
  const settings = await storage.getSettings()
  if (!settings.autoArchiveEnabled) return

  const tabs = await chrome.tabs.query({})
  const now = Date.now()
  const archiveThreshold = settings.autoArchiveMinutes * 60 * 1000

  for (const tab of tabs) {
    if (!tab.id || tab.pinned || tab.active) continue

    const lastAccessed = tabLastAccessed.get(tab.id) || 0
    if (now - lastAccessed > archiveThreshold) {
      // Archive the tab (save to storage and close)
      await archiveTab(tab)
    }
  }
}

// Archive a tab
async function archiveTab(tab: chrome.tabs.Tab) {
  if (!tab.id || !tab.url) return

  const archivedTabs = await chrome.storage.local.get('archivedTabs')
  const archived = archivedTabs.archivedTabs || []

  archived.push({
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl,
    archivedAt: Date.now(),
    timeSpent: tabTimeSpent.get(tab.id) || 0
  })

  await chrome.storage.local.set({ archivedTabs: archived })
  await chrome.tabs.remove(tab.id)
}

// Apply rules to a tab
async function applyRules(tab: chrome.tabs.Tab) {
  const rules = await storage.getTabRules()
  const enabledRules = rules.filter(r => r.enabled)

  for (const rule of enabledRules) {
    if (await matchesConditions(tab, rule.conditions)) {
      await executeActions(tab, rule.actions)
    }
  }
}

// Check if tab matches rule conditions
async function matchesConditions(tab: chrome.tabs.Tab, conditions: RuleCondition[]): Promise<boolean> {
  for (const condition of conditions) {
    let matches = false

    switch (condition.type) {
      case 'url':
        matches = matchesPattern(tab.url || '', condition.operator, condition.value, condition.caseSensitive)
        break
      case 'title':
        matches = matchesPattern(tab.title || '', condition.operator, condition.value, condition.caseSensitive)
        break
      case 'domain':
        const domain = tab.url ? new URL(tab.url).hostname : ''
        matches = matchesPattern(domain, condition.operator, condition.value, condition.caseSensitive)
        break
    }

    if (!matches) return false
  }

  return true
}

// Pattern matching helper
function matchesPattern(text: string, operator: string, pattern: string, caseSensitive?: boolean): boolean {
  const compareText = caseSensitive ? text : text.toLowerCase()
  const comparePattern = caseSensitive ? pattern : pattern.toLowerCase()

  switch (operator) {
    case 'contains':
      return compareText.includes(comparePattern)
    case 'equals':
      return compareText === comparePattern
    case 'matches':
      return new RegExp(pattern, caseSensitive ? '' : 'i').test(text)
    case 'starts_with':
      return compareText.startsWith(comparePattern)
    case 'ends_with':
      return compareText.endsWith(comparePattern)
    default:
      return false
  }
}

// Execute rule actions
async function executeActions(tab: chrome.tabs.Tab, actions: RuleAction[]) {
  if (!tab.id) return

  for (const action of actions) {
    switch (action.type) {
      case 'group':
        await addToGroup(tab.id, action.value || 'Auto-grouped')
        break
      case 'close':
        await chrome.tabs.remove(tab.id)
        break
      case 'archive':
        await archiveTab(tab)
        break
      case 'pin':
        await chrome.tabs.update(tab.id, { pinned: true })
        break
    }
  }
}

// Add tab to a group
async function addToGroup(tabId: number, groupName: string) {
  const groups = await chrome.tabGroups.query({ title: groupName })
  
  if (groups.length > 0) {
    await chrome.tabs.group({ tabIds: tabId, groupId: groups[0].id })
  } else {
    const groupId = await chrome.tabs.group({ tabIds: tabId })
    await chrome.tabGroups.update(groupId, { title: groupName })
  }
}

// Check for duplicate tabs
async function checkDuplicates(tab: chrome.tabs.Tab) {
  const settings = await storage.getSettings()
  if (!settings.duplicateDetection || !tab.url || !tab.id) return

  // Skip chrome:// URLs, new tab pages, and other special pages
  if (tab.url.startsWith('chrome://') || 
      tab.url.startsWith('chrome-extension://') ||
      tab.url === 'chrome://newtab/' ||
      tab.url === 'about:blank') {
    return
  }

  // Get all tabs and manually filter for exact URL matches
  const allTabs = await chrome.tabs.query({})
  const exactMatches = allTabs.filter(t => t.url === tab.url && t.id !== tab.id)
  
  if (exactMatches.length > 0) {
    console.log(`Found ${exactMatches.length} duplicate tabs for URL: ${tab.url}`)
    
    // Keep the most recently accessed tab (the current one)
    const sortedTabs = exactMatches.sort((a, b) => {
      const aTime = a.id ? (tabLastAccessed.get(a.id) || 0) : 0
      const bTime = b.id ? (tabLastAccessed.get(b.id) || 0) : 0
      return aTime - bTime // Oldest first, so we can remove them
    })

    // Close older duplicates
    for (const duplicateTab of sortedTabs) {
      if (duplicateTab.id && duplicateTab.id !== tab.id) {
        console.log(`Closing duplicate tab: ${duplicateTab.title} (${duplicateTab.url})`)
        await chrome.tabs.remove(duplicateTab.id)
      }
    }
  }
}

// Daily cleanup
async function performDailyCleanup() {
  // Clean up old archived tabs (older than 30 days)
  const archivedTabs = await chrome.storage.local.get('archivedTabs')
  const archived = archivedTabs.archivedTabs || []
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
  
  const filtered = archived.filter((tab: any) => tab.archivedAt > thirtyDaysAgo)
  await chrome.storage.local.set({ archivedTabs: filtered })

  // Reset daily stats
  await chrome.storage.local.set({
    dailyStats: {
      tabsOpened: 0,
      tabsClosed: 0,
      date: new Date().toDateString()
    }
  })
}

// Suspend memory-heavy tabs
async function suspendMemoryHeavyTabs() {
  const settings = await storage.getSettings()
  if (!settings.memorySaverEnabled) return

  const tabs = await chrome.tabs.query({ active: false, pinned: false })
  const tabCount = tabs.length
  
  // Calculate heuristic memory usage (Chrome doesn't provide direct memory API)
  // Estimate: Each tab uses ~50MB base + additional for media/heavy content
  const estimatedMemoryMB = tabCount * 50
  
  if (estimatedMemoryMB > settings.memorySaverThresholdMB) {
    // Find inactive tabs to suspend
    const inactiveTabs = tabs.filter(tab => {
      if (!tab.id) return false
      const lastAccessed = tabLastAccessed.get(tab.id) || 0
      return Date.now() - lastAccessed > 15 * 60 * 1000 // 15 minutes
    })

    // Sort by last accessed time (oldest first)
    inactiveTabs.sort((a, b) => {
      const aTime = a.id ? (tabLastAccessed.get(a.id) || 0) : 0
      const bTime = b.id ? (tabLastAccessed.get(b.id) || 0) : 0
      return aTime - bTime
    })

    // Suspend tabs until we're under threshold
    const tabsToSuspend = Math.ceil((estimatedMemoryMB - settings.memorySaverThresholdMB) / 50)
    const tabsToProcess = inactiveTabs.slice(0, tabsToSuspend)
    
    for (const tab of tabsToProcess) {
      if (tab.id && !tab.discarded) {
        await chrome.tabs.discard(tab.id)
      }
    }
  }
}

// Enforce tab limits
async function enforceTabLimits() {
  const settings = await storage.getSettings()
  if (!settings.tabLimitEnabled) return

  const tabs = await chrome.tabs.query({})
  const tabCount = tabs.length
  
  if (tabCount > settings.tabLimitCount) {
    // Find the oldest inactive tabs (not pinned, not active)
    const inactiveTabs = tabs.filter(tab => 
      !tab.pinned && !tab.active && tab.id
    ).sort((a, b) => {
      const aTime = a.id ? (tabLastAccessed.get(a.id) || 0) : 0
      const bTime = b.id ? (tabLastAccessed.get(b.id) || 0) : 0
      return aTime - bTime // Oldest first
    })

    const tabsToClose = tabCount - settings.tabLimitCount
    const tabsToArchive = inactiveTabs.slice(0, tabsToClose)
    
    // Archive tabs before closing to preserve them
    for (const tab of tabsToArchive) {
      await archiveTab(tab)
    }
  }
}


// Update daily statistics
async function updateDailyStats(type: 'opened' | 'closed') {
  const today = new Date().toDateString()
  const statsData = await chrome.storage.local.get('dailyStats')
  const stats = statsData.dailyStats || { date: today, tabsOpened: 0, tabsClosed: 0 }
  
  // Reset stats if it's a new day
  if (stats.date !== today) {
    stats.date = today
    stats.tabsOpened = 0
    stats.tabsClosed = 0
  }
  
  if (type === 'opened') {
    stats.tabsOpened++
  } else {
    stats.tabsClosed++
  }
  
  await chrome.storage.local.set({ dailyStats: stats })
}

// Message handler for getting previous tab
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPreviousTab') {
    sendResponse({ previousTabId })
    return true
  }
})


export {}