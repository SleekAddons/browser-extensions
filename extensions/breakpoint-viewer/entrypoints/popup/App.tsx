import ExtensionHeader from '@/components/ExtensionHeader'
import PopupContainer from '@/components/PopupContainer'
import { useScrollable } from '@/lib/useScrollable'
import BreakpointSettingsView from '../../components/BreakpointSettingsView'

export default function App() {
  const { ref: contentRef, needsPadding: contentPadding } = useScrollable()

  return (
    <PopupContainer fixedHeight className="flex flex-col">
      <ExtensionHeader />
      <div
        ref={contentRef}
        className={`min-h-0 flex-1 overflow-y-scroll ${contentPadding ? 'pr-3' : ''}`}
      >
        <BreakpointSettingsView />
      </div>
    </PopupContainer>
  )
}

