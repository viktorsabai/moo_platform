// Компонент списка адресов доставки
import React from 'react'

export function AddressList() {
  return (
    <div className="mx-auto w-full max-w-[420px] px-4 pt-5 pb-28">
      <h2 className="mb-4 text-[22px] font-extrabold tracking-tight text-black/90">addresses</h2>
      <div className="grid gap-3">
        <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_10px_28px_rgba(0,0,0,0.06)]">
          <div className="text-[15px] font-semibold text-black/85">home</div>
          <div className="mt-1 text-[13px] font-medium text-black/45">phuket, thailand</div>
          <button className="mt-3 w-full text-center py-2 rounded-full bg-[color:var(--accent)] text-[14px] font-semibold text-white shadow-[0_8px_20px_rgba(0,0,0,0.12)] transition active:scale-[0.98]">manage</button>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_10px_28px_rgba(0,0,0,0.06)]">
          <div className="text-[15px] font-semibold text-black/85">office</div>
          <div className="mt-1 text-[13px] font-medium text-black/45">bangkok, thailand</div>
          <button className="mt-3 w-full text-center py-2 rounded-full bg-[color:var(--accent)] text-[14px] font-semibold text-white shadow-[0_8px_20px_rgba(0,0,0,0.12)] transition active:scale-[0.98]">manage</button>
        </div>
      </div>
      <button className="mt-6 w-full py-3 rounded-[20px] text-lg font-semibold bg-[color:var(--accent)] text-white shadow-[0_10px_24px_rgba(209,73,63,0.22)] transition active:scale-[0.98]">add address</button>
    </div>
  )
}
