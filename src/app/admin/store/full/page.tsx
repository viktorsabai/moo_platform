import { redirect } from 'next/navigation'

/** Старый полный редактор меню заменён вкладкой «меню»; адрес оставлен для старых ссылок. */
export default function AdminStoreFullPage() {
  redirect('/admin/store')
}
