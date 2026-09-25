"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole, LogIn, Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError("Email ou mot de passe incorrect.");
      setLoading(false);
      return;
    }

    router.replace(searchParams.get("next") || "/");
    router.refresh();
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[#f5f4f0] px-5 py-10">
      <section className="w-full max-w-md rounded-2xl border border-[#e4e3dd] bg-[#fbfaf7] p-6 shadow-[0_18px_45px_rgba(23,34,56,0.08)] sm:p-8">
        <div className="mb-8">
          <div className="mb-6 flex items-center">
            <img alt="GLADIAMA SUARL" className="h-auto w-56 object-contain" src="/images/logo-gladiama.png" />
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#e8712b]">Espace sécurisé</p>
          <h1 className="font-[var(--font-space-grotesk)] text-3xl font-bold tracking-tight text-[#172238]">Connexion</h1>
          <p className="mt-2 text-sm text-[#6f7885]">Accédez à vos clients et à vos factures.</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#172238]">Email</span>
            <span className="relative block"><Mail className="pointer-events-none absolute left-4 top-3.5 text-[#9ba1a7]" size={17} /><input required autoComplete="email" className="w-full rounded-xl border border-[#d9d8d1] bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-[#e8712b]" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></span>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#172238]">Mot de passe</span>
            <span className="relative block"><LockKeyhole className="pointer-events-none absolute left-4 top-3.5 text-[#9ba1a7]" size={17} /><input required autoComplete="current-password" className="w-full rounded-xl border border-[#d9d8d1] bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-[#e8712b]" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></span>
          </label>
          {error && <p className="rounded-xl bg-[#fff1f0] px-4 py-3 text-sm font-medium text-[#c13a3a]">{error}</p>}
          <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#172238] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#263957] disabled:cursor-wait disabled:opacity-60" disabled={loading} type="submit">
            <LogIn size={17} /> {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<main className="grid min-h-dvh place-items-center bg-[#f5f4f0] text-sm text-[#6f7885]">Chargement...</main>}><LoginForm /></Suspense>;
}