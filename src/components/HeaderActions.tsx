import React from 'react'
import { 
  ArchiveIcon, 
  Cross2Icon, 
  EyeNoneIcon,
  CopyIcon,
  MoonIcon,
  SunIcon,
  GearIcon
} from '@radix-ui/react-icons'
import { cn } from '@/utils/cn'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { Settings } from '@/types'

interface HeaderActionsProps {
  settings: Settings | null
  onToggleTheme: () => void
  onActionComplete?: () => void
}

export function HeaderActions({ settings, onToggleTheme, onActionComplete }: HeaderActionsProps) {
  async function closeDuplicates() {
    const tabs = await chrome.tabs.query({ currentWindow: true })
    const urlMap = new Map<string, chrome.tabs.Tab[]>()
    
    tabs.forEach(tab => {
      if (tab.url) {
        const existing = urlMap.get(tab.url) || []
        urlMap.set(tab.url, [...existing, tab])
      }
    })

    const toClose: number[] = []
    urlMap.forEach(tabsWithSameUrl => {
      if (tabsWithSameUrl.length > 1) {
        // Keep the first one, close the rest
        tabsWithSameUrl.slice(1).forEach(tab => {
          if (tab.id) toClose.push(tab.id)
        })
      }
    })

    if (toClose.length > 0) {
      await chrome.tabs.remove(toClose)
      onActionComplete?.()
    }
  }

  async function suspendInactiveTabs() {
    const tabs = await chrome.tabs.query({ 
      currentWindow: true, 
      active: false, 
      pinned: false,
      discarded: false
    })

    for (const tab of tabs) {
      if (tab.id) {
        await chrome.tabs.discard(tab.id)
      }
    }

    onActionComplete?.()
  }

  async function archiveAllTabs() {
    const tabs = await chrome.tabs.query({ 
      currentWindow: true,
      pinned: false
    })

    const archived = tabs.map(tab => ({
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl,
      archivedAt: Date.now()
    }))

    const existing = await chrome.storage.local.get('archivedTabs')
    await chrome.storage.local.set({ 
      archivedTabs: [...(existing.archivedTabs || []), ...archived]
    })

    const tabIds = tabs.map(t => t.id).filter(Boolean) as number[]
    if (tabIds.length > 0) {
      await chrome.tabs.remove(tabIds)
      onActionComplete?.()
    }
  }

  const quickActions = [
    {
      icon: CopyIcon,
      label: 'Close Duplicates',
      onClick: closeDuplicates,
      color: 'text-orange-500'
    },
    {
      icon: EyeNoneIcon,
      label: 'Suspend Inactive',
      onClick: suspendInactiveTabs,
      color: 'text-blue-500'
    },
    {
      icon: ArchiveIcon,
      label: 'Archive All',
      onClick: archiveAllTabs,
      color: 'text-purple-500'
    }
  ]

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {/* Quick Actions */}
        <div className="flex items-center gap-1 mr-2 border-r pr-2">
          {quickActions.map((action) => (
            <Tooltip key={action.label}>
              <TooltipTrigger asChild>
                <button
                  onClick={action.onClick}
                  className={cn(
                    'p-2 rounded-md glass-hover transition-all',
                    'hover:scale-110'
                  )}
                >
                  <action.icon className={cn('w-4 h-4', action.color)} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{action.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Theme Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-md glass-hover"
              aria-label="Toggle theme"
            >
              {settings?.theme === 'dark' ? (
                <MoonIcon className="w-4 h-4" />
              ) : (
                <SunIcon className="w-4 h-4" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Toggle theme</p>
          </TooltipContent>
        </Tooltip>

        {/* Settings */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => chrome.runtime.openOptionsPage()}
              className="p-2 rounded-md glass-hover"
              aria-label="Settings"
            >
              <GearIcon className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Settings</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}