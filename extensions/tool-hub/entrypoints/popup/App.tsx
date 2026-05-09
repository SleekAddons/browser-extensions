import ExtensionHeader from '@/components/ExtensionHeader'
import PopupContainer from '@/components/PopupContainer'
import ToolHubView from '../../components/ToolHubView'

export default function App() {
  return (
    <PopupContainer height={500} fixedHeight className="flex flex-col">
      <ExtensionHeader />
      <ToolHubView />
    </PopupContainer>
  )
}
