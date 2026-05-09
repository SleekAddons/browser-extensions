import ExtensionHeader from '@/components/ExtensionHeader'
import PopupContainer from '@/components/PopupContainer'
import WebsiteBlockerView from '../../components/WebsiteBlockerView'

export default function App() {
  return (
    <PopupContainer width={500} height={600} fixedHeight className="flex h-full flex-col">
      <ExtensionHeader />
      <WebsiteBlockerView />
    </PopupContainer>
  )
}
