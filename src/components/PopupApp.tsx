import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Cross2Icon, 
  MoonIcon, 
  SunIcon,
  GearIcon,
  ArchiveIcon,
  TimerIcon,
  LayersIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  BarChartIcon
} from '@radix-ui/react-icons'
import { cn } from '@/utils/cn'
import { storage } from '@/utils/storage'
import type { TabInfo, TabGroup, Settings } from '@/types'
import { TabList } from './TabList'
import { WorkspaceView } from './WorkspaceView'
import { SearchBar } from './SearchBar'
import { TabRules } from './TabRules'
import { Analytics } from './Analytics'
import { ArchivedTabs } from './ArchivedTabs'
import { HeaderActions } from './HeaderActions'

type View = 'tabs' | 'archived' | 'automation' | 'analytics'

export function PopupApp() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [currentView, setCurrentView] = useState<View>('tabs')
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([])
  const [groups, setGroups] = useState<chrome.tabGroups.TabGroup[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([loadSettings(), loadTabs()]).then(() => {
      setIsLoading(false)
    })
  }, [])

  useEffect(() => {
    if (settings?.theme === 'dark' || 
        (settings?.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    
    // Apply accent color
    if (settings?.accentColor) {
      document.documentElement.setAttribute('data-accent', settings.accentColor)
    }
  }, [settings?.theme, settings?.accentColor])

  async function loadSettings() {
    const s = await storage.getSettings()
    setSettings(s)
  }

  async function loadTabs() {
    const [allTabs, allGroups] = await Promise.all([
      chrome.tabs.query({ currentWindow: true }),
      chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT })
    ])
    setTabs(allTabs)
    setGroups(allGroups)
  }

  async function toggleTheme() {
    if (!settings) return
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark'
    await storage.setSettings({ theme: newTheme })
    setSettings({ ...settings, theme: newTheme })
  }

  // Calculate filtered tabs for keyboard navigation
  const filteredTabs = React.useMemo(() => {
    if (!searchQuery.trim()) return []
    
    const query = searchQuery.toLowerCase()
    return tabs.filter(tab => 
      tab.title?.toLowerCase().includes(query) ||
      tab.url?.toLowerCase().includes(query)
    )
  }, [tabs, searchQuery])

  // Update selection when search changes
  React.useEffect(() => {
    // If we have search results, select the first one
    if (searchQuery.trim() && filteredTabs.length > 0) {
      setSelectedIndex(0)
    } else {
      setSelectedIndex(-1)
    }
  }, [searchQuery, filteredTabs.length])

  async function handleSearchEnter() {
    // Secret feature: if search is empty, switch to last tab
    if (!searchQuery.trim()) {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'getPreviousTab' })
        if (response?.previousTabId) {
          await chrome.tabs.update(response.previousTabId, { active: true })
          window.close()
          return
        }
      } catch (error) {
        console.error('Failed to get previous tab:', error)
      }
      return
    }
    
    // Use selected tab if available, otherwise use first match
    const targetTab = selectedIndex >= 0 && selectedIndex < filteredTabs.length
      ? filteredTabs[selectedIndex]
      : filteredTabs[0]
    
    if (targetTab?.id) {
      await chrome.tabs.update(targetTab.id, { active: true })
      window.close()
    }
  }

  function handleArrowNavigation(direction: 'up' | 'down') {
    if (filteredTabs.length === 0) return
    
    if (direction === 'down') {
      setSelectedIndex(prev => 
        prev >= filteredTabs.length - 1 ? 0 : prev + 1
      )
    } else {
      setSelectedIndex(prev => 
        prev <= 0 ? filteredTabs.length - 1 : prev - 1
      )
    }
  }

  const navItems = [
    { id: 'tabs', label: 'Tabs', icon: LayersIcon },
    { id: 'archived', label: 'Archive', icon: ArchiveIcon },
    { id: 'automation', label: 'Rules', icon: TimerIcon },
    { id: 'analytics', label: 'Analytics', icon: BarChartIcon },
  ] as const

  // Show minimal UI while loading to prevent flashes
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        {/* Empty div to maintain layout while loading */}
        <div className="w-8 h-8" />
      </div>
    )
  }

  return (
    <div className={cn('h-screen flex flex-col bg-background', settings?.densityMode)}>
      {/* Header */}
      <header className="glass flex-shrink-0 border-b">
        <div className="flex items-center justify-between p-3">
          <h1 className="text-lg font-semibold">Tab Flow</h1>
          <HeaderActions 
            settings={settings} 
            onToggleTheme={toggleTheme}
            onActionComplete={loadTabs}
          />
        </div>

        {/* Search Bar */}
        <div className="px-3 pb-3">
          <SearchBar 
            value={searchQuery} 
            onChange={setSearchQuery} 
            autoFocus={true} 
            onEnterPress={handleSearchEnter}
            onArrowNavigation={handleArrowNavigation}
          />
        </div>

        {/* Navigation */}
        <nav className="flex border-t">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                currentView === item.id && 'bg-accent text-accent-foreground'
              )}
            >
              <item.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-3 pt-6 overflow-y-auto">
        <AnimatePresence mode="wait">
          {currentView === 'tabs' && (
            <motion.div
              key="tabs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <TabList 
                tabs={tabs} 
                groups={groups} 
                searchQuery={searchQuery}
                onUpdate={loadTabs}
                selectedTabId={selectedIndex >= 0 && selectedIndex < filteredTabs.length ? filteredTabs[selectedIndex]?.id : undefined}
              />
            </motion.div>
          )}

          {currentView === 'archived' && (
            <motion.div
              key="archived"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ArchivedTabs />
            </motion.div>
          )}

          {currentView === 'automation' && (
            <motion.div
              key="automation"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <TabRules />
            </motion.div>
          )}

          {currentView === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Analytics />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}