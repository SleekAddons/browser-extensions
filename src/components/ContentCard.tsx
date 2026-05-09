import type { ReactNode } from 'react'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function ContentCard(props: {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <Card className="gap-4 py-4">
      <CardHeader className="px-4">
        <CardTitle className="flex min-w-0 items-center gap-3 text-base">
          {/* {props.icon && (
            <span className="shrink-0 [&>svg]:size-4 [&>svg]:text-current">{props.icon}</span>
          )} */}
          <span className="truncate">{props.title}</span>
        </CardTitle>
        {props.description && (
          <CardDescription className="text-balance text-sm">{props.description}</CardDescription>
        )}
        {props.action && <CardAction>{props.action}</CardAction>}
      </CardHeader>
      {props.children && (
        <CardContent className="flex flex-col gap-3 px-4">
          {props.children}
        </CardContent>
      )}
    </Card>
  )
}
