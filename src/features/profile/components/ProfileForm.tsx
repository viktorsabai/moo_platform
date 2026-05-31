import React from "react"
// Компонент формы профиля пользователя
export function ProfileForm() {
  return (
    <main className="mx-auto w-full max-w-[420px] px-4 pt-5 pb-28">
      <div className="mb-5">
        <div className="text-[22px] font-extrabold tracking-tight text-black/90">профиль</div>
        <div className="mt-1 text-[13px] font-medium text-black/45">данные аккаунта</div>
      </div>
      <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_10px_28px_rgba(0,0,0,0.06)] space-y-3">
        <label className="block text-[12px] font-semibold text-black/50">name</label>
        <input className="h-11 w-full rounded-2xl border border-black/10 bg-black/[0.02] px-4 text-[15px] font-medium text-black/80 outline-none focus:border-black/20" placeholder="имя" />
        <label className="block text-[12px] font-semibold text-black/50">email</label>
        <input className="h-11 w-full rounded-2xl border border-black/10 bg-black/[0.02] px-4 text-[15px] font-medium text-black/80 outline-none focus:border-black/20" placeholder="почта" />
        <button className="w-full text-center py-3 rounded-[20px] text-lg font-semibold bg-[color:var(--accent)] text-white shadow-[0_10px_24px_rgba(209,73,63,0.22)] transition active:scale-[0.98] disabled:opacity-40">save</button>
      </section>
    </main>
  )
}
