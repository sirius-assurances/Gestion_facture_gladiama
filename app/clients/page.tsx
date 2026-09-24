"use client";

import Link from "next/link";
import { ArrowLeft, MapPin, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import MobileNav from "@/components/layout/mobile-nav";
import { getClients, removeClient } from "@/app/actions/billing";
import type { ClientRecord } from "@/lib/invoice-storage";

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void getClients().then(setClients);
  }, []);

  const filteredClients = clients.filter((client) => `${client.name} ${client.location}`.toLowerCase().includes(query.toLowerCase()));

  const handleDelete = async (clientId: string) => {
    const nextClients = await removeClient(clientId);
    setClients(nextClients);
  };

  return (
    <main className="min-h-screen bg-[#f5f4f0] px-4 py-5 pb-24 sm:px-8 lg:ml-[248px] lg:px-12 lg:py-10 lg:pb-10">
      <div className="mx-auto max-w-5xl">
        <Link className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[#6f7885] hover:text-[#172238]" href="/">
          <ArrowLeft size={17} /> Retour au tableau de bord
        </Link>

        <div className="mb-8 flex flex-col items-start gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#e8712b]">Carnet clients</p>
            <h1 className="font-[var(--font-space-grotesk)] text-3xl font-bold tracking-tight">Vos clients</h1>
            <p className="mt-2 text-sm text-[#6f7885]">Retrouvez vos coordonnées et tarifs habituels.</p>
          </div>
          <Link className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#e8712b] px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#d86322]" href="/clients/new">
            <Plus size={18} /> <span className="hidden sm:inline">Nouveau client</span>
          </Link>
        </div>

        <div className="mb-5 flex items-center gap-3 rounded-xl border border-[#e4e3dd] bg-[#fbfaf7] px-4 py-3">
          <Search size={18} className="text-[#9ba1a7]" />
          <input className="w-full bg-transparent text-sm outline-none" placeholder="Rechercher un client..." value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {filteredClients.map((client) => (
            <article className="rounded-2xl border border-[#e4e3dd] bg-[#fbfaf7] p-5" key={client.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#fff1df] text-[#e8712b]">
                    <Users size={20} />
                  </div>
                  <div>
                    <h2 className="font-[var(--font-space-grotesk)] text-lg font-bold">{client.name}</h2>
                    <p className="mt-1 flex items-center gap-1 text-xs text-[#6f7885]">
                      <MapPin size={13} />
                      {client.location}
                    </p>
                  </div>
                </div>
                {client.hasTva && <span className="rounded-full bg-[#e5f4ed] px-2.5 py-1 text-[11px] font-semibold text-[#21744d]">TVA</span>}
              </div>

              <div className="mt-5 border-t border-[#e4e3dd] pt-4 text-sm">
                <p className="flex flex-col gap-1 text-[#6f7885] sm:block">
                  Projet <span className="font-medium text-[#172238] sm:float-right">{client.projectName ?? "Aucun projet"}</span>
                </p>
                <p className="mt-3 flex flex-col gap-1 text-[#6f7885] sm:mt-2 sm:block">
                  Tarif habituel <span className="font-semibold text-[#172238] sm:float-right">{client.defaultUnitPrice.toLocaleString("fr-FR")} FCFA / m³</span>
                </p>
              </div>

              <div className="mt-5 flex items-center gap-2">
                <Link className="flex-1 rounded-xl border border-[#e4e3dd] bg-white px-3 py-2 text-center text-sm font-semibold text-[#172238] hover:border-[#d9d8d1]" href={`/clients/${client.id}`}>
                  <span className="inline-flex items-center gap-2">
                    <Pencil size={14} /> Modifier
                  </span>
                </Link>
                <button
                  className="rounded-xl border border-[#f0d2d2] bg-[#fff8f8] p-2.5 text-[#c13a3a] hover:bg-[#ffeaea]"
                  type="button"
                  onClick={() => handleDelete(client.id)}
                  aria-label={`Supprimer ${client.name}`}
                  title="Supprimer le client"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <Link className="mt-3 block text-center text-sm font-semibold text-[#e8712b]" href={`/invoices/new?client=${client.id}`}>
                Créer une facture pour ce client
              </Link>
            </article>
          ))}
        </div>

        {filteredClients.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#d9d8d1] bg-[#fbfaf7] p-10 text-center text-sm text-[#6f7885]">
            Aucun client trouvé.
          </div>
        )}
      </div>
      <MobileNav />
    </main>
  );
}
