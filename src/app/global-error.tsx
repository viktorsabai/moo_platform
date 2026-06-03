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
       const payload = {
         type: 'global_error_boundary',
         name: (error as any)?.name,
         message: error?.message,
         stack: (error as any)?.stack,
         digest: (error as any)?.digest,
         href: typeof location !== 'undefined' ? location.href : undefined,
         ts: Date.now(),
       }

       const body = JSON.stringify(payload)
       if (typeof navigator !== 'undefined' && typeof (navigator as any).sendBeacon === 'function') {
         ;(navigator as any).sendBeacon('/api/client-error', body)
       } else {
         void fetch('/api/client-error', {
           method: 'POST',
           headers: { 'content-type': 'application/json' },
           body,
           keepalive: true,
         })
       }
     } catch {}
   }, [error])

  const clearAndReload = () => {
    softResetClientApp('/profile/owner')
  }

   return (
     <html lang="ru">
       <body>
         <main className="mx-auto w-full max-w-[1100px] px-4 pt-8 pb-28">
           <div className="rounded-[22px] border border-black/10 bg-white/80 p-5 shadow-[0_10px_26px_rgba(0,0,0,0.06)]">
             <div className="text-[16px] font-extrabold tracking-tight text-black/90">что-то пошло не так</div>
             <div className="mt-1 text-[13px] font-medium text-black/45">
               это ошибка клиента. можно безопасно сбросить кэш и продолжить.
             </div>

             <div className="mt-3 rounded-[14px] border border-black/10 bg-white/70 px-3 py-2 text-[11px] font-semibold text-black/60">
               <div className="truncate">
                 {(error as any)?.name ? String((error as any).name) : 'Error'}: {String(error?.message || '—')}
               </div>
               {(error as any)?.digest ? (
                 <div className="mt-1 text-black/40">digest: {String((error as any).digest)}</div>
               ) : null}
             </div>

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
       </body>
     </html>
   )
 }

