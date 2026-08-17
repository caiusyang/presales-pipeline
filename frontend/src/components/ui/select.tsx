import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  value: string
  onValueChange: (v: string) => void
  options: SelectOption[]
  placeholder?: string
  /** 允许清空（出现"全部/未选择"项） */
  clearable?: boolean
  clearLabel?: string
}

/**
 * 轻量下拉（原生 select 样式化）。约定：value 用 '' 表示未选；
 * 选项 value 不允许为空字符串。
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, value, onValueChange, options, placeholder, clearable, clearLabel, disabled, ...props }, ref) => (
    <div className={cn('relative', className)}>
      <select
        ref={ref}
        value={value}
        disabled={disabled}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn(
          'h-9 w-full appearance-none rounded-md border border-input bg-transparent pl-3 pr-8 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
          value === '' && 'text-muted-foreground',
        )}
        {...props}
      >
        {clearable ? (
          <option value="">{clearLabel ?? placeholder ?? '全部'}</option>
        ) : placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  ),
)
Select.displayName = 'Select'
