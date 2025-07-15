import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { 
  PlusIcon, 
  TrashIcon, 
  DownloadIcon,
  CheckIcon,
  ClockIcon,
  DotFilledIcon
} from '@radix-ui/react-icons'
import { storage } from '@/utils/storage'
import type { Workspace } from '@/types'
import { cn } from '@/utils/cn'

export function WorkspaceView() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const [currentGroups, setCurrentGroups] = useState<chrome.tabGroups.TabGroup[]>([])

  useEffect(() => {
    loadWorkspaces()
    loadCurrentGroups()
  }, [])

  async function loadWorkspaces() {
    const [ws, activeId] = await Promise.all([
      storage.getWorkspaces(),
      storage.getActiveWorkspace()
    ])
    setWorkspaces(ws)
    setActiveWorkspaceId(activeId)
  }

  async function loadCurrentGroups() {
    const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT })
    setCurrentGroups(groups)
  }

  async function saveGroup(groupId: number, groupName: string, customName?: string) {
    const tabs = await chrome.tabs.query({ currentWindow: true, groupId })
    const group = await chrome.tabGroups.get(groupId)
    
    const workspace: Workspace = {
      id: `ws_${Date.now()}`,
      name: customName || `${groupName} - ${new Date().toLocaleDateString()}`,
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
    await loadWorkspaces()
  }

  async function loadWorkspace(workspace: Workspace) {
    // Close all current tabs
    const currentTabs = await chrome.tabs.query({ currentWindow: true })
    const tabIds = currentTabs.map(t => t.id).filter(Boolean) as number[]
    if (tabIds.length > 0) {
      await chrome.tabs.remove(tabIds)
    }

    // Create new tabs from workspace
    const tabIdMap = new Map<number, number>()
    
    for (const tab of workspace.tabs) {
      if (tab.url) {
        const newTab = await chrome.tabs.create({ 
          url: tab.url,
          pinned: tab.pinned,
          active: false
        })
        if (tab.id && newTab.id) {
          tabIdMap.set(tab.id, newTab.id)
        }
      }
    }

    // Recreate groups
    for (const group of workspace.groups) {
      const tabIds = group.tabs
        .map(oldId => tabIdMap.get(oldId))
        .filter(Boolean) as number[]
      
      if (tabIds.length > 0) {
        const groupId = await chrome.tabs.group({ tabIds })
        await chrome.tabGroups.update(groupId, {
          title: group.name,
          color: group.color,
          collapsed: group.collapsed
        })
      }
    }

    await storage.setActiveWorkspace(workspace.id)
    setActiveWorkspaceId(workspace.id)
  }

  async function deleteWorkspace(id: string) {
    await storage.deleteWorkspace(id)
    if (activeWorkspaceId === id) {
      await storage.setActiveWorkspace(null)
      setActiveWorkspaceId(null)
    }
    await loadWorkspaces()
  }

  return (
    <div className="space-y-4">

      {/* Workspace List */}
      <div className="space-y-2">
        {workspaces.map((workspace, index) => (
          <motion.div
            key={workspace.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
              'p-3 rounded-lg glass glass-hover',
              activeWorkspaceId === workspace.id && 'ring-2 ring-primary'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate">{workspace.name}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{workspace.tabs.length} tabs</span>
                  <span>{workspace.groups.length} groups</span>
                  <span className="flex items-center gap-1">
                    <ClockIcon className="w-3 h-3" />
                    {new Date(workspace.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                {activeWorkspaceId === workspace.id ? (
                  <div className="p-1.5 rounded bg-primary text-primary-foreground">
                    <CheckIcon className="w-3 h-3" />
                  </div>
                ) : (
                  <button
                    onClick={() => loadWorkspace(workspace)}
                    className="p-1.5 rounded hover:bg-accent"
                    aria-label="Load workspace"
                  >
                    <DownloadIcon className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => deleteWorkspace(workspace.id)}
                  className="p-1.5 rounded hover:bg-destructive hover:text-destructive-foreground"
                  aria-label="Delete workspace"
                >
                  <TrashIcon className="w-3 h-3" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {workspaces.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No saved workspaces</p>
          <p className="text-sm mt-2">Save your current tabs to create a workspace</p>
        </div>
      )}
    </div>
  )
}