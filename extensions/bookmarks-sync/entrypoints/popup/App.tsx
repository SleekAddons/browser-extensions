import ExtensionHeader from '@/components/ExtensionHeader'
import PopupContainer from '@/components/PopupContainer'
import BookmarksSyncView from '../../components/BookmarksSyncView'

export default function App() {
  return (
    <PopupContainer height={600} fixedHeight className="flex flex-col">
      <ExtensionHeader />
      <BookmarksSyncView className="min-h-0 flex-1" />
    </PopupContainer>
  )
}
