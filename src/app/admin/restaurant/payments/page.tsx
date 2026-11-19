'use client'

import { Screen } from '@/components/kit'
import { AdminPaymentMethods } from '@/components/admin/AdminPaymentMethods'

/** Способы оплаты: QR, перевод, наличные — что гость видит при оформлении. */
export default function AdminPaymentsPage() {
  return (
    <Screen title="оплата" subtitle="как гость платит за заказ" back="/admin/more">
      <AdminPaymentMethods />
    </Screen>
  )
}
