import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  PlusIcon, 
  TrashIcon, 
  Pencil1Icon,
  CheckIcon,
  Cross2Icon,
  ChevronDownIcon,
  MagicWandIcon,
  ExclamationTriangleIcon
} from '@radix-ui/react-icons'
import { storage } from '@/utils/storage'
import type { TabRule, RuleCondition, RuleAction } from '@/types'
import { cn } from '@/utils/cn'

export function TabRules() {
  const [rules, setRules] = useState<TabRule[]>([])
  const [editingRule, setEditingRule] = useState<TabRule | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    loadRules()
  }, [])

  async function loadRules() {
    const r = await storage.getTabRules()
    setRules(r)
  }

  async function saveRule(rule: TabRule) {
    await storage.saveTabRule(rule)
    await loadRules()
    setEditingRule(null)
    setIsCreating(false)
  }

  async function deleteRule(id: string) {
    if (confirm('Delete this rule?')) {
      await storage.deleteTabRule(id)
      await loadRules()
    }
  }

  async function toggleRule(rule: TabRule) {
    await storage.saveTabRule({ ...rule, enabled: !rule.enabled })
    await loadRules()
  }

  function createNewRule(): TabRule {
    return {
      id: `rule_${Date.now()}`,
      name: 'New Rule',
      enabled: true,
      conditions: [{
        type: 'url',
        operator: 'contains',
        value: ''
      }],
      actions: [{
        type: 'group',
        value: 'New Group'
      }],
      createdAt: Date.now()
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MagicWandIcon className="w-5 h-5" />
            Automation Rules
          </h3>
          <p className="text-sm text-muted-foreground">
            Automatically organize tabs based on conditions
          </p>
        </div>
        <button
          onClick={() => {
            setEditingRule(createNewRule())
            setIsCreating(true)
          }}
          className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          aria-label="Create new rule"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Rules List */}
      <div className="space-y-2">
        <AnimatePresence>
          {rules.map((rule) => (
            <motion.div
              key={rule.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className={cn(
                'p-4 rounded-lg glass',
                !rule.enabled && 'opacity-60'
              )}
            >
              {editingRule?.id === rule.id ? (
                <RuleEditor
                  rule={editingRule}
                  onChange={setEditingRule}
                  onSave={() => saveRule(editingRule)}
                  onCancel={() => {
                    setEditingRule(null)
                    setIsCreating(false)
                  }}
                />
              ) : (
                <RuleDisplay
                  rule={rule}
                  onEdit={() => setEditingRule(rule)}
                  onDelete={() => deleteRule(rule.id)}
                  onToggle={() => toggleRule(rule)}
                />
              )}
            </motion.div>
          ))}

          {isCreating && editingRule && !rules.find(r => r.id === editingRule.id) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg glass"
            >
              <RuleEditor
                rule={editingRule}
                onChange={setEditingRule}
                onSave={() => saveRule(editingRule)}
                onCancel={() => {
                  setEditingRule(null)
                  setIsCreating(false)
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {rules.length === 0 && !isCreating && (
        <div className="text-center py-8 text-muted-foreground">
          <MagicWandIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No automation rules yet</p>
          <p className="text-sm mt-2">Create rules to automatically organize your tabs</p>
        </div>
      )}
    </div>
  )
}

interface RuleDisplayProps {
  rule: TabRule
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}

function RuleDisplay({ rule, onEdit, onDelete, onToggle }: RuleDisplayProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-medium">{rule.name}</h4>
          <div className="mt-2 space-y-1">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">When:</span>{' '}
              {rule.conditions.map((c, i) => (
                <span key={i}>
                  {i > 0 && ' AND '}
                  {c.type} {c.operator} "{c.value}"{c.caseSensitive && ' (case sensitive)'}
                </span>
              ))}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Then:</span>{' '}
              {rule.actions.map((a, i) => (
                <span key={i}>
                  {i > 0 && ', '}
                  {a.type === 'group' ? `Add to group "${a.value}"` : a.type}
                </span>
              ))}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className={cn(
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
              rule.enabled ? 'bg-primary' : 'bg-input'
            )}
          >
            <span
              className={cn(
                'inline-block h-3 w-3 transform rounded-full bg-background transition-transform',
                rule.enabled ? 'translate-x-5' : 'translate-x-1'
              )}
            />
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 rounded hover:bg-accent"
          >
            <Pencil1Icon className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded hover:bg-destructive hover:text-destructive-foreground"
          >
            <TrashIcon className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

interface RuleEditorProps {
  rule: TabRule
  onChange: (rule: TabRule) => void
  onSave: () => void
  onCancel: () => void
}

function RuleEditor({ rule, onChange, onSave, onCancel }: RuleEditorProps) {
  const conditionTypes = ['url', 'title', 'domain'] as const
  const operators = ['contains', 'equals', 'starts_with', 'ends_with'] as const
  const actionTypes = ['group', 'close', 'archive', 'pin'] as const

  function updateCondition(index: number, field: keyof RuleCondition, value: any) {
    const newConditions = [...rule.conditions]
    newConditions[index] = { ...newConditions[index], [field]: value }
    onChange({ ...rule, conditions: newConditions })
  }

  function updateAction(index: number, field: keyof RuleAction, value: any) {
    const newActions = [...rule.actions]
    newActions[index] = { ...newActions[index], [field]: value }
    onChange({ ...rule, actions: newActions })
  }

  function addCondition() {
    onChange({
      ...rule,
      conditions: [...rule.conditions, { type: 'url', operator: 'contains', value: '' }]
    })
  }

  function removeCondition(index: number) {
    onChange({
      ...rule,
      conditions: rule.conditions.filter((_, i) => i !== index)
    })
  }

  function addAction() {
    onChange({
      ...rule,
      actions: [...rule.actions, { type: 'group', value: '' }]
    })
  }

  function removeAction(index: number) {
    onChange({
      ...rule,
      actions: rule.actions.filter((_, i) => i !== index)
    })
  }

  const isValid = rule.name.trim() && 
    rule.conditions.every(c => c.value.trim()) &&
    rule.actions.length > 0

  return (
    <div className="space-y-4">
      {/* Rule Name */}
      <div>
        <label className="text-sm font-medium mb-1 block">Rule Name</label>
        <input
          type="text"
          value={rule.name}
          onChange={(e) => onChange({ ...rule, name: e.target.value })}
          className="w-full px-3 py-2 rounded-md border bg-background"
          placeholder="e.g., Organize Work Tabs"
        />
      </div>

      {/* Conditions */}
      <div>
        <label className="text-sm font-medium mb-2 block">When tab matches:</label>
        <div className="space-y-2">
          {rule.conditions.map((condition, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={condition.type}
                  onChange={(e) => updateCondition(index, 'type', e.target.value)}
                  className="px-2 pr-8 py-1 rounded border bg-background text-sm min-w-[80px]"
                >
                  {conditionTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <select
                  value={condition.operator}
                  onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                  className="px-2 pr-8 py-1 rounded border bg-background text-sm min-w-[100px]"
                >
                  {operators.map(op => (
                    <option key={op} value={op}>{op.replace('_', ' ')}</option>
                  ))}
                </select>
                {rule.conditions.length > 1 && (
                  <button
                    onClick={() => removeCondition(index)}
                    className="p-1 rounded hover:bg-destructive hover:text-destructive-foreground ml-auto"
                  >
                    <Cross2Icon className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={condition.value}
                  onChange={(e) => updateCondition(index, 'value', e.target.value)}
                  className="w-full px-2 py-1 rounded border bg-background text-sm"
                  placeholder="Enter value..."
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={condition.caseSensitive || false}
                    onChange={(e) => updateCondition(index, 'caseSensitive', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-muted-foreground">Case sensitive</span>
                </label>
              </div>
            </div>
          ))}
          <button
            onClick={addCondition}
            className="text-sm text-primary hover:underline"
          >
            + Add condition
          </button>
        </div>
      </div>

      {/* Actions */}
      <div>
        <label className="text-sm font-medium mb-2 block">Then:</label>
        <div className="space-y-2">
          {rule.actions.map((action, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={action.type}
                  onChange={(e) => updateAction(index, 'type', e.target.value)}
                  className="px-2 pr-8 py-1 rounded border bg-background text-sm min-w-[100px]"
                >
                  {actionTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <button
                  onClick={() => removeAction(index)}
                  className="p-1 rounded hover:bg-destructive hover:text-destructive-foreground ml-auto"
                >
                  <Cross2Icon className="w-3 h-3" />
                </button>
              </div>
              {action.type === 'group' && (
                <input
                  type="text"
                  value={action.value || ''}
                  onChange={(e) => updateAction(index, 'value', e.target.value)}
                  className="w-full px-2 py-1 rounded border bg-background text-sm"
                  placeholder="Group name..."
                />
              )}
            </div>
          ))}
          <button
            onClick={addAction}
            className="text-sm text-primary hover:underline"
          >
            + Add action
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm rounded-md hover:bg-accent"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!isValid}
          className={cn(
            'px-3 py-1.5 text-sm rounded-md',
            isValid 
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          Save Rule
        </button>
      </div>
    </div>
  )
}