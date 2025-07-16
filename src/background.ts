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
  const settings = await getCachedSettings()
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

// Get cached settings or load from storage
async function getCachedSettings(): Promise<Settings> {
  if (!cachedSettings) {
    cachedSettings = await storage.getSettings()
  }
  return cachedSettings
}

// Handle auto-collapse of inactive groups
async function handleAutoCollapseGroups(activeTabId: number) {
  try {
    const settings = await getCachedSettings()
    if (!settings.autoCollapseGroups) return
    
    const delay = settings.autoCollapseDelay * 1000 // Convert to milliseconds
    
    // Get the active tab and its group
    const activeTab = await chrome.tabs.get(activeTabId)
    const activeGroupId = activeTab.groupId
    
    // Get all groups in the same window
    const groups = await chrome.tabGroups.query({ windowId: activeTab.windowId })
    
    // Clear any existing timeout for the active group (if it's grouped)
    if (activeGroupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      const existingTimeout = groupCollapseTimeouts.get(activeGroupId)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
        groupCollapseTimeouts.delete(activeGroupId)
      }
    }
    
    // For each group that's not the active one, set up collapse timeout
    for (const group of groups) {
      // Skip if already collapsed
      if (group.collapsed) {
        continue
      }
      
      // Skip if this is the active group (but only if the active tab is grouped)
      if (activeGroupId !== chrome.tabGroups.TAB_GROUP_ID_NONE && group.id === activeGroupId) {
        continue
      }
      
      // Clear any existing timeout
      const existingTimeout = groupCollapseTimeouts.get(group.id)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
      }
      
      // Set new timeout
      if (delay === 0) {
        // "Immediate" collapse with minimal delay to avoid Chrome's "user may be dragging" error
        const timeout = setTimeout(async () => {
          try {
            await chrome.tabGroups.update(group.id, { collapsed: true })
            groupCollapseTimeouts.delete(group.id)
          } catch (error) {
            // Group might have been removed
            console.error(`Could not collapse group ${group.id}:`, error)
            groupCollapseTimeouts.delete(group.id)
          }
        }, 50) // 50ms delay to let Chrome finish processing user interaction
        
        groupCollapseTimeouts.set(group.id, timeout)
      } else {
        // Delayed collapse
        const timeout = setTimeout(async () => {
          try {
            // Double-check the group still exists and isn't the active group
            const currentActiveTab = await chrome.tabs.query({ active: true, windowId: activeTab.windowId })
            const currentActiveGroupId = currentActiveTab[0]?.groupId || chrome.tabGroups.TAB_GROUP_ID_NONE
            
            // Collapse if the active tab is ungrouped or in a different group
            if (currentActiveGroupId === chrome.tabGroups.TAB_GROUP_ID_NONE || group.id !== currentActiveGroupId) {
              await chrome.tabGroups.update(group.id, { collapsed: true })
            }
            groupCollapseTimeouts.delete(group.id)
          } catch (error) {
            // Group might have been removed or is now active
            console.error(`Could not collapse group ${group.id}:`, error)
            groupCollapseTimeouts.delete(group.id)
          }
        }, delay)
        
        groupCollapseTimeouts.set(group.id, timeout)
      }
    }
  } catch (error) {
    console.error('Failed to handle auto-collapse groups:', error)
  }
}

// Listen for settings changes to update alarms and cache
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'sync' && changes.settings) {
    console.log('Settings changed, updating alarms...')
    cachedSettings = changes.settings.newValue
    await setupAlarms()
  }
})

// Track group collapse timeouts
const groupCollapseTimeouts = new Map<number, NodeJS.Timeout>()

// Cache settings to reduce storage calls
let cachedSettings: Settings | null = null

// Window focus debounce timer
let windowFocusTimeout: NodeJS.Timeout | null = null

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
  
  // Handle auto-collapse groups
  const settings = await getCachedSettings()
  if (settings.autoCollapseGroups) {
    await handleAutoCollapseGroups(activeInfo.tabId)
  }
})

// Note: We're keeping onHighlighted because onActivated doesn't fire when clicking 
// on an already active tab in some cases (like after window focus)
chrome.tabs.onHighlighted.addListener(async (highlightInfo) => {
  const settings = await getCachedSettings()
  if (settings.autoCollapseGroups && highlightInfo.tabIds.length > 0) {
    // Use the first highlighted tab
    await handleAutoCollapseGroups(highlightInfo.tabIds[0])
  }
})

// Listen for tab attach events (moving tabs between windows)
chrome.tabs.onAttached.addListener(async (tabId, attachInfo) => {
  const settings = await getCachedSettings()
  if (settings.autoCollapseGroups) {
    // Small delay to let Chrome update the tab state
    setTimeout(async () => {
      await handleAutoCollapseGroups(tabId)
    }, 100)
  }
})

// Listen for tab detach events
chrome.tabs.onDetached.addListener(async (tabId, detachInfo) => {
  const settings = await getCachedSettings()
  if (settings.autoCollapseGroups) {
    // Handle auto-collapse in the old window
    const tabs = await chrome.tabs.query({ active: true, windowId: detachInfo.oldWindowId })
    if (tabs.length > 0 && tabs[0].id) {
      await handleAutoCollapseGroups(tabs[0].id)
    }
  }
})

// Handle window focus changes for auto-collapse (with debouncing)
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return
  
  // Clear any pending focus change
  if (windowFocusTimeout) {
    clearTimeout(windowFocusTimeout)
  }
  
  // Debounce rapid window focus changes
  windowFocusTimeout = setTimeout(async () => {
    const settings = await getCachedSettings()
    if (settings.autoCollapseGroups) {
      // Get the active tab in the focused window
      const tabs = await chrome.tabs.query({ active: true, windowId })
      if (tabs.length > 0 && tabs[0].id) {
        await handleAutoCollapseGroups(tabs[0].id)
      }
    }
    windowFocusTimeout = null
  }, 100) // 100ms debounce
})

// Track new tabs
chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.id) {
    tabLastAccessed.set(tab.id, Date.now())
    // Batch async operations for better performance
    await Promise.all([
      applyRules(tab),
      updateDailyStats('opened'),
      enforceTabLimits()
    ])
  }
})

// Track tab updates (only specific changes we care about)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only process complete status to run rules and duplicate detection
  if (changeInfo.status === 'complete') {
    await applyRules(tab)
    await checkDuplicates(tab)
  }
  
  // Handle group changes for auto-collapse (only if active tab)
  if ('groupId' in changeInfo && tab.active) {
    const settings = await getCachedSettings()
    if (settings.autoCollapseGroups) {
      await handleAutoCollapseGroups(tabId)
    }
  }
  // Ignore other frequent updates like title, favIconUrl, etc.
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

// Clean up collapse timeout when a group is removed
chrome.tabGroups.onRemoved.addListener(async (group) => {
  const timeout = groupCollapseTimeouts.get(group.id)
  if (timeout) {
    clearTimeout(timeout)
    groupCollapseTimeouts.delete(group.id)
  }
})

// Setup alarms for scheduled tasks
async function setupAlarms() {
  const settings = await getCachedSettings()
  
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
  const settings = await getCachedSettings()
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
    if (await matchesConditions(tab, rule.conditions, rule.conditionOperator)) {
      await executeActions(tab, rule.actions)
    }
  }
}

// Check if tab matches rule conditions
async function matchesConditions(tab: chrome.tabs.Tab, conditions: RuleCondition[], operator?: 'AND' | 'OR'): Promise<boolean> {
  // Default to AND for backward compatibility
  const logicOperator = operator || 'AND'
  
  if (logicOperator === 'OR') {
    // OR logic: at least one condition must match
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

      if (matches) return true // Return true on first match for OR
    }
    return false // No conditions matched
  } else {
    // AND logic: all conditions must match
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

      if (!matches) return false // Return false on first non-match for AND
    }
    return true // All conditions matched
  }
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
  const settings = await getCachedSettings()
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
  const settings = await getCachedSettings()
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
  const settings = await getCachedSettings()
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