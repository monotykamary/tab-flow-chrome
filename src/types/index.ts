export interface TabInfo extends chrome.tabs.Tab {
  lastAccessed?: number;
  timeSpent?: number;
}

export interface TabGroup {
  id: string;
  name: string;
  color: chrome.tabGroups.ColorEnum;
  collapsed: boolean;
  tabs: number[];
  createdAt: number;
  updatedAt: number;
  icon?: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  groups: TabGroup[];
  tabs: TabInfo[];
  createdAt: number;
  updatedAt: number;
  isActive?: boolean;
}

export interface TabRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: RuleCondition[];
  conditionOperator?: 'AND' | 'OR'; // Default to AND for backward compatibility
  actions: RuleAction[];
  createdAt: number;
  updatedAt: number;
  blockedReason?: string; // When present, rule cannot be toggled on
}

export interface RuleCondition {
  type: 'url' | 'title' | 'domain' | 'time' | 'duplicate';
  operator: 'contains' | 'equals' | 'matches' | 'starts_with' | 'ends_with';
  value: string;
  caseSensitive?: boolean;
}

export interface RuleAction {
  type: 'group' | 'close' | 'archive' | 'tag' | 'pin' | 'suspend';
  value?: string;
}

export interface TabStats {
  totalTabs: number;
  totalGroups: number;
  archivedTabs: number;
  timeByDomain: Record<string, number>;
  tabsOpenedToday: number;
  tabsClosedToday: number;
  averageTabLifespan: number;
}

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  autoArchiveEnabled: boolean;
  autoArchiveMinutes: number;
  duplicateDetection: boolean;
  memorySaverEnabled: boolean;
  memorySaverThresholdMB: number;
  memorySaverExcludedDomains: string[];
  dailyCleanupEnabled: boolean;
  dailyCleanupTime: string;
  tabLimitEnabled: boolean;
  tabLimitCount: number;
  accentColor: 'blue' | 'purple' | 'green' | 'orange' | 'pink' | 'red';
  autoCollapseGroups: boolean;
  autoCollapseDelay: number;
}