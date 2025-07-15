import React, { useMemo, useState, useEffect } from 'react'
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
}

export function TabList({ tabs, groups, searchQuery, onUpdate }: TabListProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set())
  const [savingGroup, setSavingGroup] = useState<number | null>(null)
  const [savedGroups, setSavedGroups] = useState<Map<number, string>>(new Map())
  const [savedGroupsData, setSavedGroupsData] = useState<Workspace[]>([])
  const [colorPickerOpen, setColorPickerOpen] = useState<number | null>(null)

  // Load saved groups and sync collapsed state with Chrome
  useEffect(() => {
    loadSavedGroups()
    syncCollapsedState()
  }, [groups])

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.color-picker-container')) {
        setColorPickerOpen(null)
      }
    }
    
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  async function loadSavedGroups() {
    const workspaces = await storage.getWorkspaces()
    setSavedGroupsData(workspaces)
    const savedMap = new Map<number, string>()
    
    workspaces.forEach(workspace => {
      workspace.groups.forEach(group => {
        // Extract the original group ID from the saved group ID
        const originalId = parseInt(group.id.replace('g_', ''))
        if (!isNaN(originalId)) {
          savedMap.set(originalId, workspace.id)
        }
      })
    })
    
    setSavedGroups(savedMap)
  }

  function syncCollapsedState() {
    const collapsed = new Set<number>()
    groups.forEach(group => {
      if (group.collapsed) {
        collapsed.add(group.id)
      }
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
    
    // Add saved groups that are not currently open
    savedGroupsData.forEach(workspace => {
      workspace.groups.forEach(group => {
        const originalId = parseInt(group.id.replace('g_', ''))
        if (!isNaN(originalId) && !groups.find(g => g.id === originalId)) {
          // This is a saved group that's not currently open
          grouped.set(originalId, [])
        }
      })
    })
    
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
    if (group) {
      console.log('Group color from Chrome:', group.color, 'for group:', group.title)
    }
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
      
      // If a workspace with the same name exists, delete it first
      if (existingWorkspaceIndex >= 0) {
        await storage.deleteWorkspace(workspaces[existingWorkspaceIndex].id)
      }
      
      const workspace: Workspace = {
        id: `ws_${Date.now()}`,
        name: group.title || groupName,
        groups: [{
          id: `g_${group.id}`,
          name: group.title || groupName,
          color: group.color,
          collapsed: false,
          tabs: tabs.map(t => t.id!),
          createdAt: Date.now(),
          updatedAt: Date.now()
        }],
        tabs: tabs.map(t => ({ ...t })),
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      await storage.saveWorkspace(workspace)
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
      {Array.from(groupedTabs.entries()).map(([groupId, groupTabs]) => {
        const group = getGroupInfo(groupId)
        // Expand groups when searching and they have matching tabs
        const isCollapsed = groupId && collapsedGroups.has(groupId) && (!searchQuery || groupTabs.length === 0)
        
        // Get saved group info if this is a saved group
        const savedWorkspace = savedGroupsData.find(ws => 
          ws.groups.some(g => parseInt(g.id.replace('g_', '')) === groupId)
        )
        const savedGroup = savedWorkspace?.groups.find(g => 
          parseInt(g.id.replace('g_', '')) === groupId
        )
        
        // Show saved groups even if they're closed in Chrome
        if (!group && savedGroup) {
          const savedTabs = savedWorkspace?.tabs || []
          
          return (
            <motion.div
              key={groupId || 'ungrouped'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
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
                <span className="text-xs opacity-70">(Saved - {savedTabs.length} tabs)</span>
                
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
                      // Restore the group
                      const tabIds = await Promise.all(
                        savedTabs.map(tab => chrome.tabs.create({ url: tab.url, active: false }))
                      )
                      
                      if (tabIds.length > 0 && tabIds[0].id) {
                        const newGroupId = await chrome.tabs.group({ tabIds: tabIds.map(t => t.id!) })
                        await chrome.tabGroups.update(newGroupId, {
                          title: savedGroup.name,
                          color: savedGroup.color
                        })
                        
                        // Save the new group immediately to maintain the connection
                        const workspace: Workspace = {
                          id: savedWorkspace.id,
                          name: savedWorkspace.name,
                          groups: [{
                            id: `g_${newGroupId}`,
                            name: savedGroup.name,
                            color: savedGroup.color,
                            collapsed: false,
                            tabs: tabIds.map(t => t.id!),
                            createdAt: savedGroup.createdAt,
                            updatedAt: Date.now()
                          }],
                          tabs: tabIds.map((t, idx) => ({ ...savedTabs[idx], id: t.id })),
                          createdAt: savedWorkspace.createdAt,
                          updatedAt: Date.now()
                        }
                        await storage.saveWorkspace(workspace)
                      }
                    }
                    
                    onUpdate()
                  }}
                  className="p-1.5 rounded hover:bg-black/20 transition-colors"
                  aria-label="Restore group"
                >
                  <ReloadIcon className="w-4 h-4" />
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
        
        return (
          <motion.div
            key={groupId || 'ungrouped'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "rounded-lg overflow-hidden",
              !group && "glass"
            )}
          >
            {group && (
              <div 
                className="flex items-center gap-2 px-3 py-2 text-white relative"
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
                    onClick={(e) => {
                      e.stopPropagation()
                      setColorPickerOpen(colorPickerOpen === group.id ? null : group.id)
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-black/20 transition-colors"
                    aria-label="Change group color"
                  >
                    <div className="w-3 h-3 rounded-full bg-white/30" />
                    <ChevronDownIcon className="w-3 h-3" />
                  </button>
                  {colorPickerOpen === group.id && (
                    <div className="absolute left-0 top-full mt-1 w-32 bg-popover border rounded-md shadow-lg z-50">
                    {tabGroupColors.map(({ color, name }) => (
                      <button
                        key={color}
                        onClick={() => updateGroupColor(group.id, color)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent text-foreground text-sm"
                      >
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: `var(--color-${color})` }}
                        />
                        {name}
                      </button>
                    ))}
                    </div>
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
                    className={cn("space-y-1", group ? "p-2" : "p-0")}
                    style={group ? { backgroundColor: `color-mix(in srgb, var(--color-${group.color}) 15%, transparent)` } : undefined}
                  >
                    {groupTabs.map((tab) => (
                      <motion.div
                        key={tab.id}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className={cn(
                          'group flex items-center gap-2 p-2 rounded-md',
                          'hover:bg-accent/50 cursor-pointer transition-colors',
                          !group && 'glass glass-hover'
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
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
      
      {filteredTabs.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No tabs found</p>
        </div>
      )}
    </div>
  )
}