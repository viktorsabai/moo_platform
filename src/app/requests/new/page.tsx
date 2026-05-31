import { RequestLeadClient } from './request-lead-client'

export const dynamic = 'force-dynamic'

export default function NewRequestPage({
  searchParams,
}: {
  searchParams?: { type?: string }
}) {
  return <RequestLeadClient initialType={searchParams?.type || 'catering'} />
}
