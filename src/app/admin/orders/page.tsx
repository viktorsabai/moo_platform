import { redirect } from 'next/navigation'

/** Заказы теперь на главной кабинета; адрес оставлен для кнопок в старых сообщениях бота. */
export default function AdminOrdersPage() {
  redirect('/admin')
}
