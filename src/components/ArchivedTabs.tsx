import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArchiveIcon, 
  TrashIcon, 
  ExternalLinkIcon,
  ClockIcon,
  Cross2Icon
} from '@radix-ui/react-icons'

interface ArchivedTab {
  url: string
  title: string
  favIconUrl?: string
  archivedAt: number
  timeSpent?: number
}

export function ArchivedTabs() {
  const [archivedTabs, setArchivedTabs] = useState<ArchivedTab[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadArchivedTabs()
  }, [])

  async function loadArchivedTabs() {
    const data = await chrome.storage.local.get('archivedTabs')
    setArchivedTabs(data.archivedTabs || [])
  }

  async function restoreTab(tab: ArchivedTab, index: number) {
    await chrome.tabs.create({ url: tab.url })
    
    // Remove from archived
    const newArchived = [...archivedTabs]
    newArchived.splice(index, 1)
    setArchivedTabs(newArchived)
    await chrome.storage.local.set({ archivedTabs: newArchived })
  }

  async function deleteArchivedTab(index: number) {
    const newArchived = [...archivedTabs]
    newArchived.splice(index, 1)
    setArchivedTabs(newArchived)
    await chrome.storage.local.set({ archivedTabs: newArchived })
  }

  async function clearAll() {
    if (confirm('Clear all archived tabs? This cannot be undone.')) {
      setArchivedTabs([])
      await chrome.storage.local.set({ archivedTabs: [] })
    }
  }

  const filteredTabs = archivedTabs.filter(tab => 
    !searchQuery || 
    tab.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tab.url?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Sort by archived date (newest first)
  const sortedTabs = [...filteredTabs].sort((a, b) => b.archivedAt - a.archivedAt)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ArchiveIcon className="w-5 h-5" />
            Archived Tabs
          </h3>
          <p className="text-sm text-muted-foreground">
            {archivedTabs.length} archived tabs
          </p>
        </div>
        {archivedTabs.length > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-destructive hover:text-destructive-foreground"
          >
            <TrashIcon className="w-4 h-4" />
            Clear All
          </button>
        )}
      </div>

      {/* Search */}
      {archivedTabs.length > 0 && (
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search archived tabs..."
          className="w-full px-3 py-2 rounded-md border bg-background text-sm"
        />
      )}

      {/* Archived Tabs List */}
      <div className="space-y-2">
        <AnimatePresence>
          {sortedTabs.map((tab) => {
            const originalIndex = archivedTabs.indexOf(tab)
            return (
                <motion.div
                  key={`${tab.url}-${tab.archivedAt}`}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="group relative flex items-center gap-2 p-3 rounded-lg glass glass-hover"
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
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{tab.title || 'Untitled'}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="truncate">{new URL(tab.url).hostname}</span>
                      <span className="flex items-center gap-1">
                        <ClockIcon className="w-3 h-3" />
                        {formatDate(tab.archivedAt)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Actions - overlay on the right */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 backdrop-blur-sm rounded-md p-1 shadow-sm">
                    <button
                      onClick={() => restoreTab(tab, originalIndex)}
                      className="p-1.5 rounded hover:bg-accent"
                      aria-label="Restore tab"
                    >
                      <ExternalLinkIcon className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => deleteArchivedTab(originalIndex)}
                      className="p-1.5 rounded hover:bg-destructive hover:text-destructive-foreground"
                      aria-label="Delete archived tab"
                    >
                      <Cross2Icon className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {archivedTabs.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <ArchiveIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No archived tabs</p>
          <p className="text-sm mt-2">Tabs will appear here when archived</p>
        </div>
      )}

      {archivedTabs.length > 0 && filteredTabs.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No matching tabs found</p>
        </div>
      )}
    </div>
  )
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 3600000) { // Less than 1 hour
    const minutes = Math.floor(diff / 60000)
    return `${minutes}m ago`
  } else if (diff < 86400000) { // Less than 1 day
    const hours = Math.floor(diff / 3600000)
    return `${hours}h ago`
  } else if (diff < 604800000) { // Less than 1 week
    const days = Math.floor(diff / 86400000)
    return `${days}d ago`
  } else {
    return date.toLocaleDateString()
  }
}

