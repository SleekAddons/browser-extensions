import type { ReactNode } from 'react'

export default function SectionHeading(props: { children: ReactNode }) {
  return (
    <h3 className="mb-3 font-semibold tracking-tight">
      {props.children}
    </h3>
  )
}
