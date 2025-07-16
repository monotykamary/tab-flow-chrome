import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MoonIcon, 
  SunIcon,
  LaptopIcon,
  ArchiveIcon,
  TrashIcon,
  ActivityLogIcon,
  MixerHorizontalIcon,
  BellIcon,
  DownloadIcon,
  UploadIcon,
  LayersIcon
} from '@radix-ui/react-icons'
import { cn } from '@/utils/cn'
import { storage } from '@/utils/storage'
import type { Settings } from '@/types'

export function OptionsApp() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadSettings()
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

  async function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    if (!settings) return
    
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    await storage.setSettings({ [key]: value })
    
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!settings) return null

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Tab Flow Settings</h1>
          <p className="text-muted-foreground">Customize your tab management experience</p>
        </header>

        <div className="space-y-6">
          {/* Appearance */}
          <Section title="Appearance" icon={MixerHorizontalIcon}>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['light', 'dark', 'system'] as const).map((theme) => (
                    <button
                      key={theme}
                      onClick={() => updateSetting('theme', theme)}
                      className={cn(
                        'flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors',
                        settings.theme === theme 
                          ? 'border-primary bg-primary/10' 
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      {theme === 'light' && <SunIcon className="w-4 h-4" />}
                      {theme === 'dark' && <MoonIcon className="w-4 h-4" />}
                      {theme === 'system' && <LaptopIcon className="w-4 h-4" />}
                      <span className="capitalize">{theme}</span>
                    </button>
                  ))}
                </div>
              </div>


              <div>
                <label className="text-sm font-medium mb-2 block">Accent Color</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['blue', 'purple', 'green', 'orange', 'pink', 'red'] as const).map((color) => {
                    const colorMap = {
                      blue: 'bg-blue-500',
                      purple: 'bg-purple-500',
                      green: 'bg-green-500',
                      orange: 'bg-orange-500',
                      pink: 'bg-pink-500',
                      red: 'bg-red-500'
                    }
                    return (
                      <button
                        key={color}
                        onClick={() => updateSetting('accentColor', color)}
                        className={cn(
                          'flex items-center gap-2 p-3 rounded-lg border-2 transition-colors capitalize',
                          settings.accentColor === color 
                            ? 'border-primary bg-primary/10' 
                            : 'border-border hover:border-primary/50'
                        )}
                      >
                        <div className={cn('w-4 h-4 rounded-full', colorMap[color as keyof typeof colorMap])} />
                        <span>{color}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

            </div>
          </Section>

          {/* Auto-Archive */}
          <Section title="Auto-Archive" icon={ArchiveIcon}>
            <div className="space-y-4">
              <Switch
                label="Enable auto-archive"
                description="Automatically archive inactive tabs"
                checked={settings.autoArchiveEnabled}
                onChange={(checked) => updateSetting('autoArchiveEnabled', checked)}
              />
              
              {settings.autoArchiveEnabled && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Archive tabs inactive for
                  </label>
                  <select
                    value={settings.autoArchiveMinutes}
                    onChange={(e) => updateSetting('autoArchiveMinutes', Number(e.target.value))}
                    className="w-full p-2 rounded-md border bg-background"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={120}>2 hours</option>
                    <option value={240}>4 hours</option>
                  </select>
                </div>
              )}
            </div>
          </Section>

          {/* Daily Cleanup */}
          <Section title="Daily Cleanup" icon={TrashIcon}>
            <div className="space-y-4">
              <Switch
                label="Enable daily cleanup"
                description="Automatically clean up tabs at a scheduled time"
                checked={settings.dailyCleanupEnabled}
                onChange={(checked) => updateSetting('dailyCleanupEnabled', checked)}
              />
              
              {settings.dailyCleanupEnabled && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Cleanup time
                  </label>
                  <input
                    type="time"
                    value={settings.dailyCleanupTime}
                    onChange={(e) => updateSetting('dailyCleanupTime', e.target.value)}
                    className="w-full p-2 rounded-md border bg-background"
                  />
                </div>
              )}
            </div>
          </Section>

          {/* Memory Management */}
          <Section title="Memory Management" icon={ActivityLogIcon}>
            <div className="space-y-4">
              <Switch
                label="Enable memory saver"
                description="Suspend inactive tabs to save memory"
                checked={settings.memorySaverEnabled}
                onChange={(checked) => updateSetting('memorySaverEnabled', checked)}
              />
              
              {settings.memorySaverEnabled && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Memory threshold (MB)
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="2000"
                    step="100"
                    value={settings.memorySaverThresholdMB}
                    onChange={(e) => updateSetting('memorySaverThresholdMB', Number(e.target.value))}
                    className="w-full p-2 rounded-md border bg-background"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Suspend tabs when memory usage exceeds this threshold
                  </p>
                </div>
              )}
              
              <Switch
                label="Duplicate detection"
                description="Automatically close duplicate tabs"
                checked={settings.duplicateDetection}
                onChange={(checked) => updateSetting('duplicateDetection', checked)}
              />
            </div>
          </Section>

          {/* Tab Limits */}
          <Section title="Tab Limits" icon={BellIcon}>
            <div className="space-y-4">
              <Switch
                label="Enable tab limit"
                description="Set a maximum number of open tabs"
                checked={settings.tabLimitEnabled}
                onChange={(checked) => updateSetting('tabLimitEnabled', checked)}
              />
              
              {settings.tabLimitEnabled && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Maximum tabs
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="200"
                    value={settings.tabLimitCount}
                    onChange={(e) => updateSetting('tabLimitCount', Number(e.target.value))}
                    className="w-full p-2 rounded-md border bg-background"
                  />
                </div>
              )}
            </div>
          </Section>

          {/* Group Management */}
          <Section title="Group Management" icon={LayersIcon}>
            <div className="space-y-4">
              <Switch
                label="Auto-collapse inactive groups"
                description="Automatically collapse tab groups when switching away"
                checked={settings.autoCollapseGroups}
                onChange={(checked) => updateSetting('autoCollapseGroups', checked)}
              />
              
              {settings.autoCollapseGroups && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Collapse delay (seconds)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={settings.autoCollapseDelay}
                    onChange={(e) => updateSetting('autoCollapseDelay', Number(e.target.value))}
                    className="w-full p-2 rounded-md border bg-background"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Wait this many seconds before collapsing inactive groups (0 for immediate)
                  </p>
                </div>
              )}
            </div>
          </Section>

          {/* Data Management */}
          <Section title="Data Management" icon={DownloadIcon}>
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const data = await chrome.storage.local.get()
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `tab-flow-backup-${new Date().toISOString().split('T')[0]}.json`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <DownloadIcon className="w-4 h-4" />
                  Export Data
                </button>
                <button
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = '.json'
                    input.onchange = async (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0]
                      if (!file) return
                      
                      const text = await file.text()
                      try {
                        const data = JSON.parse(text)
                        await chrome.storage.local.set(data)
                        loadSettings()
                        setSaved(true)
                        setTimeout(() => setSaved(false), 2000)
                      } catch (error) {
                        console.error('Failed to import data:', error)
                      }
                    }
                    input.click()
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-md border hover:bg-accent"
                >
                  <UploadIcon className="w-4 h-4" />
                  Import Data
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Export your settings, workspaces, and rules as a backup or to transfer to another device.
              </p>
            </div>
          </Section>
        </div>

        {/* Save indicator */}
        <AnimatePresence>
          {saved && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-8 right-8 px-4 py-2 bg-primary text-primary-foreground rounded-md shadow-lg"
            >
              Settings saved
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

interface SectionProps {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}

function Section({ title, icon: Icon, children }: SectionProps) {
  return (
    <div className="bg-card rounded-lg border p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  )
}

interface SwitchProps {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function Switch({ label, description, checked, onChange }: SwitchProps) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <div className="flex-1">
        <div className="font-medium">{label}</div>
        {description && (
          <div className="text-sm text-muted-foreground">{description}</div>
        )}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-input'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-background transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </label>
  )
}