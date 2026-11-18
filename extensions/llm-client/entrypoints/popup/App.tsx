import ExtensionHeader from '@/components/ExtensionHeader'
import PopupContainer from '@/components/PopupContainer'
import OllamaClientView from '../../components/OllamaClientView'

export default function App() {
  return (
    <PopupContainer width={600} height={600} fixedHeight className="flex flex-col">
      <ExtensionHeader />
      <OllamaClientView className="min-h-0 flex-1" />
    </PopupContainer>
  )
}
