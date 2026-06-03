'use client'

import { useEffect } from 'react'
import { softResetClientApp } from '@/lib/client-app-recovery'

 export default function GlobalError({
   error,
   reset,
 }: {
   error: Error & { digest?: string }
   reset: () => void
 }) {
   useEffect(() => {
     try {
       void fetch('/api/client-error', {
         method: 'POST',
         headers: { 'content-type': 'application/json' },
         body: JSON.stringify({
           type: 'app_error_boundary',
           message: error?.message,
           stack: (error as any)?.stack,
           digest: (error as any)?.digest,
           href: typeof location !== 'undefined' ? location.href : undefined,
           ts: Date.now(),
         }),
       })
     } catch {}
   }, [error])

  const clearAndReload = () => {
    softResetClientApp('/profile/owner')
  }

   return (
     <main className="mx-auto w-full max-w-[1100px] px-4 pt-8 pb-28">
       <div className="rounded-[22px] border border-black/10 bg-white/80 p-5 shadow-[0_10px_26px_rgba(0,0,0,0.06)]">
        <div className="text-[16px] font-extrabold tracking-tight text-black/90">что-то пошло не так</div>
        <div className="mt-1 text-[13px] font-medium text-black/45">
          это ошибка. мы уже зафиксировали событие.
        </div>
        {(error?.message || (error as any)?.digest) && (
          <div className="mt-3 rounded-xl border border-black/10 bg-black/[0.03] px-3 py-2 text-[11px] text-black/60 font-mono break-all">
            {(error as any)?.digest ? `digest: ${(error as any).digest}` : null}
            {error?.message ? (error as any)?.digest ? ` — ${error.message}` : error.message : null}
          </div>
        )}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
           <button
             type="button"
             onClick={() => reset()}
             className="inline-flex h-11 items-center justify-center rounded-full bg-black px-6 text-[13px] font-semibold text-white transition active:scale-[0.98]"
           >
             попробовать снова
           </button>
           <button
             type="button"
             onClick={clearAndReload}
             className="inline-flex h-11 items-center justify-center rounded-full bg-black/[0.03] px-6 text-[13px] font-semibold text-black/70 transition active:scale-[0.98]"
           >
             выбрать заведение заново
           </button>
         </div>
       </div>
     </main>
   )
 }

