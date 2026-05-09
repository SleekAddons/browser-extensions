import type { ReactNode } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Option<T extends string> {
  value: T
  label: ReactNode
}

interface OptionPickerProps<T extends string> {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
}

export default function OptionPicker<T extends string>(props: OptionPickerProps<T>) {
  return (
    <Tabs
      value={props.value}
      onValueChange={(v) => props.onChange(v as T)}
    >
      <TabsList className="w-full">
        {props.options.map((opt) => (
          <TabsTrigger key={opt.value} value={opt.value} disabled={props.disabled} className="flex-1 ">
            {opt.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
