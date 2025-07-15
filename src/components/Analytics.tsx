import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { 
  BarChartIcon,
  ClockIcon,
  LayersIcon,
  ActivityLogIcon,
  ArchiveIcon,
  ExternalLinkIcon,
  TriangleUpIcon,
  TriangleDownIcon
} from '@radix-ui/react-icons'
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts'
import { cn } from '@/utils/cn'
import type { TabStats } from '@/types'

export function Analytics() {
  const [stats, setStats] = useState<TabStats | null>(null)
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    setLoading(true)
    try {
      // Get current tabs
      const tabs = await chrome.tabs.query({})
      const groups = await chrome.tabGroups.query({})
      
      // Get archived tabs
      const archivedData = await chrome.storage.local.get('archivedTabs')
      const archivedTabs = archivedData.archivedTabs || []
      
      // Get daily stats
      const dailyData = await chrome.storage.local.get('dailyStats')
      const dailyStats = dailyData.dailyStats || { tabsOpened: 0, tabsClosed: 0 }
      
      // Calculate domain stats
      const domainStats: Record<string, number> = {}
      tabs.forEach(tab => {
        if (tab.url) {
          try {
            const domain = new URL(tab.url).hostname
            domainStats[domain] = (domainStats[domain] || 0) + 1
          } catch {}
        }
      })
      
      // Calculate average tab lifespan from archived tabs
      const lifespans = archivedTabs
        .filter((tab: any) => tab.timeSpent)
        .map((tab: any) => tab.timeSpent)
      
      const avgLifespan = lifespans.length > 0 
        ? lifespans.reduce((a: number, b: number) => a + b, 0) / lifespans.length
        : 0
      
      setStats({
        totalTabs: tabs.length,
        totalGroups: groups.length,
        archivedTabs: archivedTabs.length,
        timeByDomain: domainStats,
        tabsOpenedToday: dailyStats.tabsOpened || tabs.length,
        tabsClosedToday: dailyStats.tabsClosed || archivedTabs.filter((t: any) => {
          const today = new Date().toDateString()
          return new Date(t.archivedAt).toDateString() === today
        }).length,
        averageTabLifespan: avgLifespan
      })
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <ActivityLogIcon className="w-8 h-8 animate-pulse mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    )
  }

  // Prepare chart data
  const domainData = Object.entries(stats.timeByDomain)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([domain, count]) => ({
      name: domain.length > 20 ? domain.substring(0, 20) + '...' : domain,
      value: count
    }))

  const pieColors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

  const activityData = [
    { name: 'Opened', value: stats.tabsOpenedToday, color: '#00C49F' },
    { name: 'Closed', value: stats.tabsClosedToday, color: '#FF8042' },
    { name: 'Active', value: stats.totalTabs, color: '#0088FE' },
    { name: 'Archived', value: stats.archivedTabs, color: '#8884D8' }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
          <BarChartIcon className="w-5 h-5" />
          Tab Analytics
        </h3>
        <div className="flex items-center gap-2">
          {(['today', 'week', 'month'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                'px-3 py-1 text-sm rounded-md capitalize',
                timeRange === range
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              )}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={LayersIcon}
          label="Active Tabs"
          value={stats.totalTabs}
          trend={stats.tabsOpenedToday - stats.tabsClosedToday}
        />
        <StatCard
          icon={ArchiveIcon}
          label="Archived"
          value={stats.archivedTabs}
          trend={stats.tabsClosedToday}
        />
        <StatCard
          icon={ClockIcon}
          label="Avg. Lifespan"
          value={formatDuration(stats.averageTabLifespan)}
          small
        />
        <StatCard
          icon={LayersIcon}
          label="Tab Groups"
          value={stats.totalGroups}
        />
      </div>

      {/* Top Domains Chart */}
      {domainData.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Top Domains</h4>
          <div className="h-48 glass rounded-lg p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={domainData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10 }} 
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Bar dataKey="value" fill="#0088FE" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Activity Distribution */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Tab Activity</h4>
        <div className="glass rounded-lg p-4">
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={activityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={50}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {activityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 justify-center mt-4">
            {activityData.map((item, index) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <div 
                  className="w-2.5 h-2.5 rounded" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs text-muted-foreground">
                  {item.name}: {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  trend?: number
  small?: boolean
}

function StatCard({ icon: Icon, label, value, trend, small }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-lg p-3"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <p className={cn("font-semibold", small ? "text-lg" : "text-2xl")}>
            {value}
          </p>
        </div>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-2">
          {trend > 0 ? (
            <TriangleUpIcon className="w-3 h-3 text-green-500" />
          ) : trend < 0 ? (
            <TriangleDownIcon className="w-3 h-3 text-red-500" />
          ) : null}
          <span className={cn(
            "text-xs",
            trend > 0 ? "text-green-500" : trend < 0 ? "text-red-500" : "text-muted-foreground"
          )}>
            {trend > 0 ? '+' : ''}{trend}
          </span>
        </div>
      )}
    </motion.div>
  )
}


function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`
  return `${Math.round(ms / 3600000)}h`
}