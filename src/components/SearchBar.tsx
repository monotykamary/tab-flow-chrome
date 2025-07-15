import React, { useEffect, useRef } from 'react'
import { MagnifyingGlassIcon } from '@radix-ui/react-icons'
import { cn } from '@/utils/cn'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
  onEnterPress?: () => void
  onArrowNavigation?: (direction: 'up' | 'down') => void
}

export function SearchBar({ value, onChange, placeholder = 'Search tabs...', autoFocus = false, onEnterPress, onArrowNavigation }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      // Small delay to ensure the popup is fully rendered
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [autoFocus])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onEnterPress) {
      e.preventDefault()
      onEnterPress()
    } else if (e.key === 'ArrowDown' && onArrowNavigation) {
      e.preventDefault()
      onArrowNavigation('down')
    } else if (e.key === 'ArrowUp' && onArrowNavigation) {
      e.preventDefault()
      onArrowNavigation('up')
    }
  }

  return (
    <div className="relative">
      <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          'w-full pl-10 pr-4 py-2 rounded-md',
          'bg-background border border-input',
          'focus:outline-none focus:ring-2 focus:ring-ring',
          'text-sm placeholder:text-muted-foreground'
        )}
      />
    </div>
  )
}