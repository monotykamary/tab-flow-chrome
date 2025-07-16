import React, { useMemo, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Cross2Icon, 
  DrawingPinIcon, 
  DotFilledIcon, 
  ChevronDownIcon,
  ChevronRightIcon,
  BookmarkIcon,
  BookmarkFilledIcon,
  ReloadIcon
} from '@radix-ui/react-icons'
import { cn } from '@/utils/cn'
import { storage } from '@/utils/storage'
import type { Workspace } from '@/types'

interface TabListProps {
  tabs: chrome.tabs.Tab[]
  groups: chrome.tabGroups.TabGroup[]
  searchQuery: string
  onUpdate: () => void
  selectedTabId?: number
}

// Helper function to wait for tabs to fully load
const waitForTabsToLoad = (tabIds: number[], maxWaitMs = 10000): Promise<chrome.tabs.Tab[]> => {
  return new Promise((resolve) => {
    const loadingTabs = new Set(tabIds);
    const startTime = Date.now();
    let checkCompleteTimer: NodeJS.Timeout;
    
    const checkComplete = async () => {
      // Get current tab states
      const tabs = await Promise.all(
        Array.from(loadingTabs).map(id => chrome.tabs.get(id))
      );
      
      // Check which tabs are complete with proper titles
      const completeTabs = tabs.filter(tab => {
        // Consider a tab "complete" when it has a real title (not default values)
        // and status is complete
        return tab.status === 'complete' && 
               tab.title && 
               tab.title !== 'New Tab' && 
               tab.title !== 'Untitled' &&
               !tab.title.startsWith('chrome://');
      });
      
      // Remove completed tabs from tracking
      completeTabs.forEach(tab => loadingTabs.delete(tab.id!));
      
      // If all tabs are loaded or we've hit the timeout
      if (loadingTabs.size === 0 || Date.now() - startTime > maxWaitMs) {
        clearTimeout(checkCompleteTimer);
        chrome.tabs.onUpdated.removeListener(updateListener);
        
        // Get final state of all tabs
        const finalTabs = await Promise.all(tabIds.map(id => chrome.tabs.get(id)));
        resolve(finalTabs);
      }
    };
    
    const updateListener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (loadingTabs.has(tabId)) {
        // Check if this update indicates the tab might be ready
        if (changeInfo.status === 'complete' || changeInfo.title) {
          // Debounce the check to avoid too many calls
          clearTimeout(checkCompleteTimer);
          checkCompleteTimer = setTimeout(checkComplete, 100);
        }
      }
    };
    
    // Listen for tab updates
    chrome.tabs.onUpdated.addListener(updateListener);
    
    // Initial check - some tabs might already be loaded
    checkComplete();
    
    // Also set up periodic checks in case we miss events
    const pollInterval = setInterval(() => {
      if (loadingTabs.size > 0 && Date.now() - startTime < maxWaitMs) {
        checkComplete();
      } else {
        clearInterval(pollInterval);
      }
    }, 500);
  });
};

export function TabList({ tabs, groups, searchQuery, onUpdate, selectedTabId }: TabListProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set())
  const [savingGroup, setSavingGroup] = useState<number | null>(null)
  const [savedGroups, setSavedGroups] = useState<Map<number, string>>(new Map())
  const [savedGroupsData, setSavedGroupsData] = useState<Workspace[]>([])
  const [colorPickerOpen, setColorPickerOpen] = useState<number | null>(null)
  const [colorPickerPosition, setColorPickerPosition] = useState<{ top: number; left: number } | null>(null)
  const [restoringGroups, setRestoringGroups] = useState<Set<number>>(new Set())
  const colorPickerButtonRef = useRef<HTMLButtonElement>(null)
  // Load saved groups and sync collapsed state with Chrome
  useEffect(() => {
    loadSavedGroups()
  }, [])
  
  // Sync collapsed state when groups or saved groups change
  useEffect(() => {
    syncCollapsedState()
  }, [groups, savedGroupsData])
  
  // Auto-save active groups when they change
  useEffect(() => {
    autoSaveActiveGroups()
  }, [groups, tabs])

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.color-picker-container')) {
        setColorPickerOpen(null)
        setColorPickerPosition(null)
      }
    }
    
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  async function loadSavedGroups() {
    const workspaces = await storage.getWorkspaces()
    setSavedGroupsData(workspaces)
    const savedMap = new Map<number, string>()
    
    // Also check for active groups that match saved groups by name
    const activeGroups = groups
    
    workspaces.forEach(workspace => {
      workspace.groups.forEach(group => {
        // First, check if there's an active group with the same name
        const activeGroup = activeGroups.find(g => g.title === group.name)
        if (activeGroup) {
          // Map the active group ID to this workspace
          savedMap.set(activeGroup.id, workspace.id)
        } else {
          // Otherwise, use the saved group ID as before
          const originalId = parseInt(group.id.replace('g_', ''))
          if (!isNaN(originalId)) {
            savedMap.set(originalId, workspace.id)
          }
        }
      })
    })
    
    setSavedGroups(savedMap)
  }
  
  async function autoSaveActiveGroups() {
    // Don't auto-save on initial load
    if (groups.length === 0) return
    
    // For each active group, check if there's a saved workspace with the same name
    for (const group of groups) {
      const workspaces = await storage.getWorkspaces()
      const existingWorkspace = workspaces.find(ws => ws.name === group.title)
      
      if (existingWorkspace) {
        // Update the existing workspace with current tab state
        const tabs = await chrome.tabs.query({ currentWindow: true, groupId: group.id })
        
        const updatedWorkspace: Workspace = {
          ...existingWorkspace,
          groups: [{
            id: `g_${group.id}`,
            name: group.title || 'Untitled Group',
            color: group.color,
            collapsed: group.collapsed,
            tabs: tabs.map(t => t.id!),
            createdAt: existingWorkspace.groups[0].createdAt,
            updatedAt: Date.now()
          }],
          tabs: tabs.map(t => ({ ...t })),
          updatedAt: Date.now()
        }
        
        await storage.saveOrUpdateWorkspaceByName(updatedWorkspace)
      }
    }
    
    // Reload to update UI
    await loadSavedGroups()
  }

  function syncCollapsedState() {
    const collapsed = new Set<number>()
    groups.forEach(group => {
      if (group.collapsed) {
        collapsed.add(group.id)
      }
    })
    
    // Also add saved groups that are closed (not in Chrome) as collapsed by default
    savedGroupsData.forEach(workspace => {
      workspace.groups.forEach(savedGroup => {
        const groupId = parseInt(savedGroup.id.replace('g_', ''))
        if (!isNaN(groupId) && !groups.find(g => g.id === groupId)) {
          // This saved group is not open in Chrome, so collapse it by default
          // But don't collapse if it's being restored
          if (!restoringGroups.has(groupId)) {
            collapsed.add(groupId)
          }
        }
      })
    })
    
    setCollapsedGroups(collapsed)
  }

  const filteredTabs = useMemo(() => {
    if (!searchQuery) return tabs
    
    const query = searchQuery.toLowerCase()
    return tabs.filter(tab => 
      tab.title?.toLowerCase().includes(query) ||
      tab.url?.toLowerCase().includes(query)
    )
  }, [tabs, searchQuery])

  const groupedTabs = useMemo(() => {
    const grouped = new Map<number | undefined, chrome.tabs.Tab[]>()
    
    // Group tabs by groupId
    filteredTabs.forEach(tab => {
      // Normalize ungrouped tabs: if groupId is -1 (TAB_GROUP_ID_NONE), treat as undefined
      const normalizedGroupId = tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE ? undefined : tab.groupId
      const existing = grouped.get(normalizedGroupId) || []
      grouped.set(normalizedGroupId, [...existing, tab])
    })
    
    // Add saved groups that are not currently open (only when not searching)
    if (!searchQuery) {
      savedGroupsData.forEach(workspace => {
        workspace.groups.forEach(group => {
          // Check if there's an active group with the same name
          const activeGroup = groups.find(g => g.title === group.name)
          if (!activeGroup) {
            // Only add if there's no active group with this name
            const originalId = parseInt(group.id.replace('g_', ''))
            if (!isNaN(originalId)) {
              grouped.set(originalId, [])
            }
          }
        })
      })
    }
    
    return grouped
  }, [filteredTabs, savedGroupsData, groups])

  async function closeTab(tabId: number) {
    await chrome.tabs.remove(tabId)
    onUpdate()
  }

  async function activateTab(tabId: number) {
    await chrome.tabs.update(tabId, { active: true })
    window.close()
  }

  async function togglePin(tab: chrome.tabs.Tab) {
    if (tab.id) {
      await chrome.tabs.update(tab.id, { pinned: !tab.pinned })
      onUpdate()
    }
  }

  function getGroupInfo(groupId?: number) {
    if (!groupId || groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) return null
    const group = groups.find(g => g.id === groupId)
    return group
  }

  function toggleGroupCollapse(groupId: number) {
    const newCollapsed = new Set(collapsedGroups)
    if (newCollapsed.has(groupId)) {
      newCollapsed.delete(groupId)
    } else {
      newCollapsed.add(groupId)
    }
    setCollapsedGroups(newCollapsed)
  }

  async function toggleSaveGroup(groupId: number, groupName: string) {
    setSavingGroup(groupId)
    
    const workspaces = await storage.getWorkspaces()
    const existingWorkspaceIndex = workspaces.findIndex(ws => ws.name === groupName)
    
    if (savedGroups.has(groupId)) {
      // Unsave the group
      const workspaceId = savedGroups.get(groupId)
      if (workspaceId) {
        await storage.deleteWorkspace(workspaceId)
      }
    } else {
      // Save the group
      const tabs = await chrome.tabs.query({ currentWindow: true, groupId })
      const group = await chrome.tabGroups.get(groupId)
      
      const workspace: Workspace = {
        id: existingWorkspaceIndex >= 0 ? workspaces[existingWorkspaceIndex].id : `ws_${Date.now()}`,
        name: group.title || groupName,
        groups: [{
          id: `g_${group.id}`,
          name: group.title || groupName,
          color: group.color,
          collapsed: false,
          tabs: tabs.map(t => t.id!),
          createdAt: existingWorkspaceIndex >= 0 ? workspaces[existingWorkspaceIndex].groups[0].createdAt : Date.now(),
          updatedAt: Date.now()
        }],
        tabs: tabs.map(t => ({ ...t })),
        createdAt: existingWorkspaceIndex >= 0 ? workspaces[existingWorkspaceIndex].createdAt : Date.now(),
        updatedAt: Date.now()
      }

      await storage.saveOrUpdateWorkspaceByName(workspace)
    }
    
    await loadSavedGroups() // Reload saved groups to update UI
    setSavingGroup(null)
  }

  async function updateGroupColor(groupId: number, color: chrome.tabGroups.ColorEnum) {
    await chrome.tabGroups.update(groupId, { color })
    onUpdate()
  }

  const tabGroupColors: Array<{ color: chrome.tabGroups.ColorEnum; name: string }> = [
    { color: 'grey', name: 'Grey' },
    { color: 'blue', name: 'Blue' },
    { color: 'red', name: 'Red' },
    { color: 'yellow', name: 'Yellow' },
    { color: 'green', name: 'Green' },
    { color: 'pink', name: 'Pink' },
    { color: 'purple', name: 'Purple' },
    { color: 'cyan', name: 'Cyan' },
    { color: 'orange', name: 'Orange' }
  ]

  return (
    <div className="space-y-4">
      {Array.from(groupedTabs.entries()).map(([groupId, groupTabs], groupIndex) => {
        const group = getGroupInfo(groupId)
        // Expand groups when searching and they have matching tabs
        // Also expand if group is being restored
        const isCollapsed = groupId && collapsedGroups.has(groupId) && (!searchQuery || groupTabs.length === 0) && !restoringGroups.has(groupId)
        
        // Get saved group info if this is a saved group
        const savedWorkspace = group 
          ? savedGroupsData.find(ws => ws.name === group.title)
          : savedGroupsData.find(ws => 
              ws.groups.some(g => parseInt(g.id.replace('g_', '')) === groupId)
            )
        const savedGroup = savedWorkspace?.groups[0]
        
        // Show saved groups even if they're closed in Chrome
        if (!group && savedGroup) {
          const savedTabs = savedWorkspace?.tabs || []
          
          const groupAnimationDuration = Math.min(0.15 + (groupIndex * 0.05), 0.3)
          
          return (
            <motion.div
              key={groupId || 'ungrouped'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: groupAnimationDuration }}
              className="rounded-lg overflow-hidden glass"
            >
              <div 
                className="flex items-center gap-2 px-3 py-2 text-white relative"
                style={{ backgroundColor: `var(--color-${savedGroup.color})` }}
              >
                <button
                  onClick={() => toggleGroupCollapse(groupId)}
                  className="p-0.5 hover:bg-black/20 rounded transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRightIcon className="w-4 h-4" />
                  ) : (
                    <ChevronDownIcon className="w-4 h-4" />
                  )}
                </button>
                
                <span className="text-sm font-medium flex-1">{savedGroup.name || 'Untitled Group'}</span>
                <span className="text-xs opacity-70">
                  {restoringGroups.has(groupId) 
                    ? 'Loading tabs...' 
                    : `(Saved - ${savedTabs.length} tabs)`
                  }
                </span>
                
                <button
                  onClick={async () => {
                    // Check if a group with this name already exists
                    const existingGroup = groups.find(g => g.title === savedGroup.name)
                    
                    if (existingGroup) {
                      // Group already exists, just switch to it
                      const groupTabs = await chrome.tabs.query({ groupId: existingGroup.id })
                      if (groupTabs.length > 0 && groupTabs[0].id) {
                        await chrome.tabs.update(groupTabs[0].id, { active: true })
                      }
                    } else {
                      // Mark as restoring and expand the group immediately
                      setRestoringGroups(prev => new Set(prev).add(groupId))
                      setCollapsedGroups(prev => {
                        const next = new Set(prev)
                        next.delete(groupId)
                        return next
                      })
                      
                      try {
                        // Restore the group
                        const tabIds = await Promise.all(
                          savedTabs.map(tab => chrome.tabs.create({ url: tab.url, active: false }))
                        )
                        
                        if (tabIds.length > 0 && tabIds[0].id) {
                          const newGroupId = await chrome.tabs.group({ tabIds: tabIds.map(t => t.id!) })
                          await chrome.tabGroups.update(newGroupId, {
                            title: savedGroup.name,
                            color: savedGroup.color,
                            collapsed: false
                          })
                          
                          // Wait for all tabs to fully load
                          const loadedTabs = await waitForTabsToLoad(tabIds.map(t => t.id!))
                          
                          // Update the workspace with the new group ID and loaded tab info
                          const updatedWorkspace: Workspace = {
                            ...savedWorkspace,
                            groups: [{
                              ...savedGroup,
                              id: `g_${newGroupId}`,
                              tabs: loadedTabs.map(t => t.id!),
                              updatedAt: Date.now()
                            }],
                            tabs: loadedTabs,
                            updatedAt: Date.now()
                          }
                          
                          await storage.saveOrUpdateWorkspaceByName(updatedWorkspace)
                          await loadSavedGroups()
                          
                          // Remove both the old saved group ID and new Chrome group ID from collapsed state
                          setCollapsedGroups(prev => {
                            const next = new Set(prev)
                            next.delete(groupId) // Remove old saved group ID
                            next.delete(newGroupId) // Remove new Chrome group ID
                            return next
                          })
                          
                          // Force Chrome to expand the group
                          await chrome.tabGroups.update(newGroupId, { collapsed: false })
                          
                          onUpdate()
                        }
                      } finally {
                        // Remove from restoring set
                        setRestoringGroups(prev => {
                          const next = new Set(prev)
                          next.delete(groupId)
                          return next
                        })
                      }
                    }
                  }}
                  disabled={restoringGroups.has(groupId)}
                  className="p-1.5 rounded hover:bg-black/20 transition-colors disabled:opacity-50"
                  aria-label="Restore group"
                >
                  <ReloadIcon className={cn("w-4 h-4", restoringGroups.has(groupId) && "animate-spin")} />
                </button>
                
                <button
                  onClick={() => toggleSaveGroup(groupId, savedGroup.name || 'Untitled Group')}
                  disabled={savingGroup === groupId}
                  className="p-1.5 rounded hover:bg-black/20 transition-colors"
                  aria-label="Unsave group"
                >
                  <BookmarkFilledIcon className="w-4 h-4" />
                </button>
              </div>
              
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div
                    initial={false}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div 
                      className="space-y-1 p-2"
                      style={{ backgroundColor: `color-mix(in srgb, var(--color-${savedGroup.color}) 15%, transparent)` }}
                    >
                      {savedTabs.map((tab, index) => (
                        <div
                          key={`saved-${tab.id}-${index}`}
                          className="group flex items-center gap-2 p-2 rounded-md bg-background/50"
                        >
                          <div className="w-4 h-4 flex-shrink-0">
                            {tab.favIconUrl ? (
                              <img 
                                src={tab.favIconUrl} 
                                alt="" 
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            ) : (
                              <div className="w-4 h-4 bg-muted rounded" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">
                              {tab.title || 'Untitled'}
                            </p>
                            {tab.url && (
                              <p className="text-xs text-muted-foreground truncate">
                                {new URL(tab.url).hostname}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        }
        
        // Don't show unsaved closed groups, but DO show ungrouped tabs
        // Ungrouped tabs have groupId === undefined (normalized from TAB_GROUP_ID_NONE)
        if (!group && !savedGroup && groupId !== undefined) {
          return null
        }
        
        const groupAnimationDuration = Math.min(0.15 + (groupIndex * 0.05), 0.3)
        
        return (
          <motion.div
            key={groupId || 'ungrouped'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: groupAnimationDuration }}
            className={cn(
              "rounded-lg",
              !group && "glass"
            )}
          >
            {group && (
              <div 
                className="flex items-center gap-2 px-3 py-2 text-white relative rounded-t-lg"
                style={{ backgroundColor: `var(--color-${group.color})` }}
              >
                <button
                  onClick={() => toggleGroupCollapse(group.id)}
                  className="p-0.5 hover:bg-black/20 rounded transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRightIcon className="w-4 h-4" />
                  ) : (
                    <ChevronDownIcon className="w-4 h-4" />
                  )}
                </button>
                
                <div className="relative color-picker-container">
                  <button
                    ref={colorPickerButtonRef}
                    onClick={(e) => {
                      e.stopPropagation()
                      
                      if (colorPickerOpen !== group.id) {
                        // Calculate position when opening
                        const button = e.currentTarget
                        const rect = button.getBoundingClientRect()
                        const spaceBelow = window.innerHeight - rect.bottom
                        
                        // Position below if space, otherwise above
                        const top = spaceBelow > 200 ? rect.bottom + 4 : rect.top - 200 - 4
                        setColorPickerPosition({ top, left: rect.left })
                      } else {
                        setColorPickerPosition(null)
                      }
                      
                      setColorPickerOpen(colorPickerOpen === group.id ? null : group.id)
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-black/20 transition-colors"
                    aria-label="Change group color"
                  >
                    <div className="w-3 h-3 rounded-full bg-white/30" />
                    <ChevronDownIcon className="w-3 h-3" />
                  </button>
                  {colorPickerOpen === group.id && colorPickerPosition && createPortal(
                    <div 
                      className="fixed w-32 bg-popover border rounded-md shadow-lg z-[9999] max-h-[200px] overflow-y-auto"
                      style={{ top: colorPickerPosition.top, left: colorPickerPosition.left }}
                    >
                    {tabGroupColors.map(({ color, name }) => (
                      <button
                        key={color}
                        onClick={() => {
                          updateGroupColor(group.id, color)
                          setColorPickerOpen(null)
                          setColorPickerPosition(null)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-foreground text-sm"
                      >
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: `var(--color-${color})` }}
                        />
                        {name}
                      </button>
                    ))}
                    </div>,
                    document.body
                  )}
                </div>
                
                <span className="text-sm font-medium flex-1">{group.title || 'Untitled Group'}</span>
                <span className="text-xs opacity-70">({groupTabs.length})</span>
                
                <button
                  onClick={() => toggleSaveGroup(group.id, group.title || 'Untitled Group')}
                  disabled={savingGroup === group.id}
                  className="p-1.5 rounded hover:bg-black/20 transition-colors"
                  aria-label={savedGroups.has(group.id) ? "Unsave group" : "Save group"}
                >
                  {savedGroups.has(group.id) ? (
                    <BookmarkFilledIcon className="w-4 h-4" />
                  ) : (
                    <BookmarkIcon className="w-4 h-4" />
                  )}
                </button>
                
                <button
                  onClick={async (e) => {
                    e.stopPropagation()
                    // Get all tabs in the group
                    const tabIds = groupTabs.map(t => t.id).filter(Boolean) as number[]
                    if (tabIds.length > 0) {
                      await chrome.tabs.remove(tabIds)
                      onUpdate()
                    }
                  }}
                  className="p-1.5 rounded hover:bg-black/20 transition-colors"
                  aria-label="Close group"
                >
                  <Cross2Icon className="w-4 h-4" />
                </button>
              </div>
            )}
            
            <AnimatePresence>
              {(!group || !isCollapsed) && (
                <motion.div
                  initial={false}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div 
                    className={cn("space-y-1", group ? "p-2" : "p-2")}
                    style={group ? { backgroundColor: `color-mix(in srgb, var(--color-${group.color}) 15%, transparent)` } : undefined}
                  >
                    {groupTabs.map((tab, tabIndex) => {
                      // Calculate animation parameters based on position
                      // First tab is instant, then gradual increase
                      const animationDuration = tabIndex === 0 ? 0 : Math.min(0.1 + (tabIndex * 0.05), 0.3)
                      const animationDistance = tabIndex === 0 ? 0 : Math.min(5 + (tabIndex * 1.5), 10)
                      
                      return (
                        <motion.div
                          key={tab.id}
                          layout
                          initial={{ opacity: 0, x: -animationDistance }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: animationDistance }}
                          transition={{ duration: animationDuration }}
                          className={cn(
                            'group flex items-center gap-2 p-2 rounded-md',
                            'hover:bg-accent/50 cursor-pointer transition-colors',
                            !group && 'glass glass-hover',
                            selectedTabId === tab.id && 'ring-2 ring-primary bg-primary/10'
                          )}
                          style={group ? { backgroundColor: `color-mix(in srgb, var(--color-${group.color}) 10%, transparent)` } : undefined}
                          onClick={() => tab.id && activateTab(tab.id)}
                        >
                  {/* Favicon */}
                  <div className="w-4 h-4 flex-shrink-0">
                    {tab.favIconUrl ? (
                      <img 
                        src={tab.favIconUrl} 
                        alt="" 
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="w-4 h-4 bg-muted rounded" />
                    )}
                  </div>
                  
                  {/* Title */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      {tab.title || 'Untitled'}
                    </p>
                    {tab.url && (
                      <p className="text-xs text-muted-foreground truncate">
                        {new URL(tab.url).hostname}
                      </p>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        togglePin(tab)
                      }}
                      className={cn(
                        'p-1 rounded hover:bg-accent',
                        tab.pinned && 'text-primary'
                      )}
                      aria-label={tab.pinned ? 'Unpin tab' : 'Pin tab'}
                    >
                      <DrawingPinIcon className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        tab.id && closeTab(tab.id)
                      }}
                      className="p-1 rounded hover:bg-destructive hover:text-destructive-foreground"
                      aria-label="Close tab"
                    >
                      <Cross2Icon className="w-3 h-3" />
                    </button>
                  </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
      
      {filteredTabs.length === 0 && searchQuery && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No matching tabs found</p>
        </div>
      )}
      
      {filteredTabs.length === 0 && !searchQuery && groupedTabs.size === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No tabs open</p>
        </div>
      )}
    </div>
  )
}