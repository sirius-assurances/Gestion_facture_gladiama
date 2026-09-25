"use client";

import Link from "next/link";
import { ArrowLeft, Check, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/app/actions/billing";
import MobileNav from "@/components/layout/mobile-nav";

export default function NewClientPage() {
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const data = new FormData(event.currentTarget);
    const client = {
      name: String(data.get("name") ?? "").trim(),
      location: String(data.get("location") ?? "").trim() || "Dakar, Sénégal",
      phone: String(data.get("phone") || ""),
      email: String(data.get("email") || ""),
      projectName: String(data.get("projectName") || ""),
      defaultUnitPrice: Number(data.get("price") ?? 0),
      hasTva: data.get("tva") === "on",
    };

    if (!client.name) return;

    await createClient(client);
    setSaved(true);
    window.setTimeout(() => router.push("/clients"), 700);
  }

  return (
    <main className="min-h-dvh bg-[#f5f4f0] px-4 py-5 pb-24 sm:px-8 lg:ml-[248px] lg:px-12 lg:py-10 lg:pb-10">
      <div className="mx-auto max-w-2xl">
        <Link className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[#6f7885] hover:text-[#172238]" href="/clients">
          <ArrowLeft size={17} /> Retour aux clients
        </Link>

        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#e8712b]">Nouveau client</p>
          <h1 className="font-[var(--font-space-grotesk)] text-2xl font-bold tracking-tight sm:text-3xl">Ajouter un client</h1>
        </div>

        <form className="rounded-2xl border border-[#e4e3dd] bg-[#fbfaf7] p-5 sm:p-8" onSubmit={handleSubmit}>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-semibold">Nom du client</span>
              <input required name="name" className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]" placeholder="Ex. GRANUSEN" />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-semibold">Localisation</span>
              <input required name="location" defaultValue="Dakar, Sénégal" className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]" />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Téléphone (optionnel)</span>
              <input name="phone" type="tel" pattern="\\+221[0-9]{9}" placeholder="+221XXXXXXXXX" className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]" />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Email (optionnel)</span>
              <input name="email" type="email" placeholder="client@example.com" className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]" />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-semibold">Projet (optionnel)</span>
              <input name="projectName" placeholder="Ex. Travaux de terrassement" className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]" />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Tarif standard (FCFA)</span>
              <input required name="price" type="number" defaultValue={600} min={0} className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]" />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-[#e4e3dd] bg-white p-4">
              <span>
                <span className="block text-sm font-semibold">TVA</span>
                <span className="mt-1 block text-xs text-[#6f7885]">Cocher si ce client est soumis à la TVA</span>
              </span>
              <input name="tva" type="checkbox" className="h-5 w-5 accent-[#e8712b]" />
            </label>
          </div>

          <div className="mt-8 flex flex-col-reverse items-stretch justify-end gap-3 sm:flex-row sm:items-center">
            <button type="button" className="rounded-xl border border-[#e4e3dd] bg-white px-4 py-3 text-sm font-semibold text-[#172238] hover:border-[#d9d8d1]" onClick={() => router.push("/clients")}>
              Annuler
            </button>
            <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-[#e8712b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#d86322]">
              <Save size={17} /> {saved ? <><Check size={17} /> Enregistré</> : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
      <MobileNav />
    </main>
  );
}
