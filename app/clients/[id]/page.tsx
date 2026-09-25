"use client";

import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import MobileNav from "@/components/layout/mobile-nav";
import { getClient, updateClient } from "@/app/actions/billing";
import type { ClientRecord } from "@/lib/invoice-storage";

export default function ClientEditPage() {
  const params = useParams();
  const router = useRouter();
  const [client, setClient] = useState<ClientRecord | null>(null);

  useEffect(() => {
    async function loadClient() {
      const found = await getClient(params.id as string);
      setClient(found);
    }
    void loadClient();
  }, [params.id]);

  if (!client) {
    return (
      <main className="min-h-screen bg-[#f5f4f0] px-5 py-6 sm:px-8 lg:ml-[248px] lg:px-12 lg:py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#e4e3dd] bg-[#fbfaf7] p-10 text-center text-sm text-[#6f7885]">
          Client introuvable.
        </div>
      </main>
    );
  }

  const updateField = <K extends keyof ClientRecord>(key: K, value: ClientRecord[K]) => {
    setClient((current) => (current ? { ...current, [key]: value } : current));
  };

  const handleSave = async () => {
    await updateClient(client);
    router.push("/clients");
  };

  return (
    <main className="min-h-screen bg-[#f5f4f0] px-4 py-5 pb-24 sm:px-8 lg:ml-[248px] lg:px-12 lg:py-10 lg:pb-10">
      <div className="mx-auto max-w-2xl">
        <Link className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[#6f7885] hover:text-[#172238]" href="/clients">
          <ArrowLeft size={17} /> Retour aux clients
        </Link>

        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#e8712b]">Modifier client</p>
          <h1 className="font-[var(--font-space-grotesk)] text-2xl font-bold tracking-tight sm:text-3xl">{client.name}</h1>
          {(client.createdByEmail || client.updatedByEmail) && (
            <p className="mt-2 text-xs text-[#9ba1a7]">
              {client.createdByEmail && <>Créé par {client.createdByEmail}</>}
              {client.createdByEmail && client.updatedByEmail && client.updatedByEmail !== client.createdByEmail && (
                <> · Modifié par {client.updatedByEmail}</>
              )}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-[#e4e3dd] bg-[#fbfaf7] p-5 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-semibold">Nom du client</span>
              <input
                className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]"
                value={client.name}
                onChange={(event) => updateField("name", event.target.value)}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-semibold">Localisation</span>
              <input
                className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]"
                value={client.location}
                onChange={(event) => updateField("location", event.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Téléphone</span>
              <input
                className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]"
                value={client.phone ?? ""}
                onChange={(event) => updateField("phone", event.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Email</span>
              <input
                className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]"
                value={client.email ?? ""}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-semibold">Projet</span>
              <input
                className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]"
                value={client.projectName ?? ""}
                onChange={(event) => updateField("projectName", event.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Tarif standard</span>
              <input
                className="w-full rounded-xl border border-[#d9d8d1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e8712b]"
                type="number"
                value={client.defaultUnitPrice}
                onChange={(event) => updateField("defaultUnitPrice", Number(event.target.value))}
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-[#e4e3dd] bg-white p-4">
              <span>
                <span className="block text-sm font-semibold">TVA</span>
                <span className="mt-1 block text-xs text-[#6f7885]">Appliquer la TVA à ce client</span>
              </span>
              <input
                checked={client.hasTva}
                className="h-5 w-5 accent-[#e8712b]"
                type="checkbox"
                onChange={(event) => updateField("hasTva", event.target.checked)}
              />
            </label>
          </div>

          <div className="mt-8 flex items-center justify-end">
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-[#e8712b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#d86322]"
              type="button"
              onClick={handleSave}
            >
              <Save size={17} /> Enregistrer
            </button>
          </div>
        </div>
      </div>
      <MobileNav />
    </main>
  );
}
