import ExtensionHeader from '@/components/ExtensionHeader'
import PopupContainer from '@/components/PopupContainer'
import PiholeManagerView from '../../components/PiholeManagerView'

export default function App() {
  return (
    <PopupContainer height={600} fixedHeight className="flex flex-col">
      <ExtensionHeader />
      <PiholeManagerView className="min-h-0 flex-1" />
    </PopupContainer>
  )
}
