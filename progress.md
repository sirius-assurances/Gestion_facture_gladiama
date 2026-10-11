# Progression du projet

Dernière mise à jour : 2026-10-11

## Objectif

Application de facturation GLADIAMA SUARL : gestion des clients, des factures,
génération des PDF et **envoi par email**, sur PostgreSQL Supabase (schéma
`facturation`), déployée sur Vercel.

## État actuel

L'application est **en production et fonctionnelle**, envoi d'emails compris.
Base Supabase à jour (6 migrations appliquées), authentification Supabase par
cookies, deux comptes utilisateurs aux droits identiques.

Qualité : 87 tests unitaires, 8 tests d'intégration (vraie base), 11 tests E2E
actifs + 1 ignoré par défaut (vrai navigateur), et un CI GitHub Actions qui
exécute tout sauf les E2E à chaque push (voir *Reste à faire*).

## Démarrer

```bash
npm run dev          # ⚠️ voir le piège des ports ci-dessous
npm test             # tests unitaires (rapides, sans base)
npm run check:smtp   # vérifie les identifiants SMTP sans rien envoyer
npm run test:e2e     # E2E Playwright (nécessite E2E_EMAIL / E2E_PASSWORD)

npm run test:db:up        # Postgres jetable (Docker)
npm run test:db:prepare    # applique les migrations dessus
npm run test:integration   # tests d'intégration
npm run test:db:down       # arrête et supprime la base de test
```

## Fonctionnalité d'envoi par email (nouveau, octobre 2026)

Le bouton « Email » de la page de détail ouvre un écran de vérification —
expéditeur, destinataire, Cc, objet, message, pièce jointe listée — plutôt que
de passer par un lien `mailto:`. `mailto:` ne peut transporter aucun fichier
(limite du protocole, pas du navigateur) ; l'envoi passe donc par le serveur,
PDF réellement attaché.

- `lib/email/mailer.ts` — configuration SMTP entièrement pilotée par
  l'environnement (`SMTP_SERVICE` préremplit hôte/port pour gmail, outlook,
  hotmail, resend). Rien n'est en dur : changer de boîte d'envoi est un
  changement de variables, jamais de code.
- `lib/email/invoice-message.ts` — lettre professionnelle générée à partir de
  la facture (projet, échéance, références marché/contrat), jamais du texte
  libre pour les montants : le sender édite la lettre, jamais les chiffres.
  HTML (tableaux + styles en ligne, pas de `<style>` ni flexbox/grid — les
  clients mail les suppriment) + texte brut en alternative.
- `app/actions/billing.ts` — `getInvoiceEmailDraft` / `sendInvoiceEmail`.
  Le statut ne passe à « Envoyée » que si l'envoi réussit vraiment. Le PDF est
  archivé **avant** le passage à « Envoyée » (storeInvoicePdf refuse d'écraser
  une facture déjà émise — voir plus bas).
- `components/invoices/email-dialog.tsx` — l'écran lui-même. Case « Marquer
  comme envoyée » décochable pour tester sans verrouiller une vraie facture.
- `scripts/check-smtp.mjs` (`npm run check:smtp`) — ouvre une vraie connexion
  SMTP, authentifie, **n'envoie rien**, et traduit l'erreur serveur en
  diagnostic lisible. À lancer avant tout nouvel essai d'identifiants.
- Champ **Cc par client** (migration 0006, `Client.ccEmails`, tableau
  Postgres) : préremplit le Cc à l'ouverture de la fenêtre, modifiable au cas
  par cas.

**Vérifié en production** (pas seulement en local) : envoi réel accepté,
PDF de 458 Ko reçu avec ses mentions légales, champ Cc prérempli depuis la
fiche client, statut inchangé quand la case n'est pas cochée.

**Configuré en production** : `SMTP_SERVICE=gmail`, boîte personnelle de
l'utilisateur (voir `.env.example` pour la liste des variables). Le nom de
domaine `gladiamadigital.com` existe et sa zone DNS est active chez
Cloudflare, mais **sans enregistrement MX** : rien ne peut y être reçu. Tant
qu'on ne bascule pas sur Resend + ce domaine, l'expéditeur reste une adresse
Gmail/Outlook personnelle, avec éventuellement un `Reply-To` différent.

## Génération des PDF côté serveur (octobre 2026)

`lib/pdf/server.ts` (`generateInvoicePdfBuffer`) rend le PDF depuis la base
seule, sans navigateur — condition nécessaire pour l'envoi automatique et les
futures relances planifiées. `lib/pdf/generator.ts` a été scindé : le dessin
(`renderInvoice`) est partagé, seul le chargement des 3 images diffère (fetch
côté navigateur, lecture disque côté serveur).

Piège réel et déjà rencontré : **Next trace les imports, pas les fichiers
ouverts par chemin**. Sans `outputFileTracingIncludes` dans
`next.config.ts`, `public/images/` disparaît de la fonction Vercel déployée
et chaque PDF part sans logo ni cachet — en silence, le document s'ouvre quand
même. Vérifié en production après coup : PDF serveur de 325 Ko (texte seul
≈ 3 Ko), donc les images sont bien embarquées. Le test E2E
`invoice-pdf.spec.ts` vérifie maintenant qu'un PDF téléchargé dépasse 100 Ko,
précisément pour attraper une régression de ce genre.

La page de détail ne poste plus le PDF en base64 vers une Server Action
(plafond ~1 Mo levé, et le document archivé ne peut plus être une version non
enregistrée du formulaire) : elle demande l'URL signée au serveur et travaille
dessus. Le formulaire de **création**, lui, garde jsPDF côté navigateur — une
facture qui n'a pas encore de ligne en base n'a rien à demander au serveur.

## Facture émise = verrouillée (octobre 2026)

Une facture au-delà du statut « Brouillon » ne peut plus être modifiée
(`isInvoiceIssued` dans `lib/invoice.ts`, vérifié côté serveur contre le
statut **stocké**, pas celui envoyé par le client). `updateInvoice` refuse
clairement, le formulaire est dans un `<fieldset disabled>`, et
`storeInvoicePdf` ne réécrit plus le fichier une fois émis — pour que le
document que le client a reçu reste exactement celui-là en cas de litige.
Repasser en « Brouillon » est le seul moyen de corriger, et ça archive
d'abord le PDF émis sous un nom horodaté (best-effort : un échec d'archivage
ne doit jamais bloquer la correction).

## Pièges connus (chèrement acquis)

- **Port de dev** : une autre application de la machine (BILMS) occupe le
  port 3000. Next se décale alors sur **3001**. Vérifier le titre de la page
  avant de conclure à un bug d'authentification.
- **PDF sur Safari iOS** : pas d'iframe PDF, pas de résolution de `blob:`
  créée dans un autre onglet. D'où l'upload vers Supabase Storage puis
  l'ouverture d'une URL signée `https`, et `window.open()` appelé **avant**
  tout `await` (sinon Safari le bloque comme pop-up).
- **Zoom automatique iOS Safari** : tout `<input>`/`<select>` sous 16px fait
  zoomer Safari au focus, sans jamais dézoomer — l'app entière restait
  "flottante" tant qu'on ne pinçait pas l'écran à la main. Corrigé par une
  règle CSS `@media (hover: none) and (pointer: coarse) { font-size: 16px }`,
  testée par `e2e/mobile-zoom.spec.ts`.
- **Mots de passe d'application Microsoft/Google** : un compte Microsoft créé
  avec une adresse `@gmail.com` n'a **aucune boîte Outlook** — générer un mot
  de passe d'application dessus ne débloque rien pour `smtp-mail.outlook.com`.
  Il faut une vraie boîte hébergée par le fournisseur dont on utilise le
  serveur SMTP.
- **Gmail et les emails à soi-même** : un message envoyé vers sa propre
  adresse d'expédition n'arrive **pas** en boîte de réception (Gmail le classe
  directement dans "Tous les messages" / "Envoyés", sans notification). Ce
  n'est pas un échec d'envoi — à ne pas confondre avec un vrai problème SMTP.
  Toujours tester vers une adresse différente de l'expéditeur.
- **Next trace les imports, pas les fichiers lus par chemin** (voir section
  PDF serveur ci-dessus) : tout nouveau fichier lu via `fs` depuis
  `public/` doit être ajouté à `outputFileTracingIncludes`.
- **Migration 0005** touche le schéma `storage` propre à Supabase. Elle ne
  peut pas être modifiée (empreinte déjà enregistrée en production) : la base
  de test reçoit un stub via `scripts/prepare-test-db.mjs`.
- **CI** : `tsconfig` inclut `.next/types`, généré par Next. Sur un checkout
  propre il faut `npx next typegen` avant `tsc`, sinon `LayoutProps` est
  introuvable.
- **Auth Supabase** : enchaîner les connexions déclenche une limitation de
  débit. Les E2E se connectent une seule fois et réutilisent la session.
- **Seed de démo** : désactivé par défaut, derrière `ENABLE_DEMO_SEED=1`.
  Ne jamais l'activer sur une base contenant de vraies factures.

## Incident de production (résolu, octobre 2026)

Les factures **avec TVA** ne pouvaient être ni téléchargées ni visualisées :
4 en-têtes déclarés pour 4 bornes de colonnes au lieu de 5, `NaN` dans jsPDF.
Deux défauts connexes falsifiaient les documents : numéro prévisualisé issu du
compte de lignes au lieu de la séquence Postgres, références marché/contrat
codées en dur. Les trois sont corrigés, vérifiés sur la base réelle, couverts
par des tests.

## Reste à faire

Par ordre de priorité, selon la dernière discussion avec l'utilisateur :

1. **Traçabilité des envois** — rien n'enregistre aujourd'hui qui a envoyé
   quoi ni quand (`sentAt`, `sentToEmail`, `sentByEmail` à ajouter sur
   `Invoice`). Repoussé pour l'instant : un seul utilisateur (le patron)
   envoie réellement des factures, donc le risque de double-envoi est faible
   dans l'immédiat. Condition préalable aux relances automatiques (point 2).
2. **Relances automatiques** des factures échues non payées (tâche planifiée
   quotidienne). La logique d'échéance/retard existe déjà dans `lib/invoice.ts`
   (`isInvoiceOverdue`) ; il manque le déclencheur et la dépendance au point 1.
3. **Contacts clients encore fictifs**, volontairement, pour les tests et
   démos (`PFO AFRICA`, `GRANUSEN`, `Beta`/SOGEA SATOM). Aucun des domaines
   `*.sn` associés n'existe réellement — un envoi réel rebondirait. **C'est
   le seul point qui sépare la démo d'un outil réellement en service.**
4. Exécuter les E2E dans le CI (nécessite une instance accessible et des
   identifiants de test en secrets GitHub).
5. `invoice-lifecycle.spec.ts` reste ignoré par défaut (`E2E_ALLOW_WRITES=1`
   requis, contre une base jetable uniquement).
6. Mise à jour de Next.js pour la RCE critique signalée par `npm audit` dans
   `next/og` (`ImageResponse`) — non exploitable ici, l'app ne l'utilise pas,
   mais à traiter par hygiène.
7. Cosmétique : 3 avertissements ESLint `<img>` vs `next/image`, champ
   `defaultProduct` présent en base mais inutilisé, liste client du menu
   déroulant non paginée, pas de limitation de débit applicative.
8. Le numéro de facture affiché avant enregistrement reste une prédiction
   (deux créations simultanées pourraient viser le même numéro) — latent,
   jamais observé en pratique à deux utilisateurs.

## Fichiers principaux

- `app/actions/billing.ts` : toutes les Server Actions (lecture, écriture,
  pagination, métriques, PDF, email). Chacune vérifie la session.
- `lib/invoice.ts` : modèle métier (types, statuts, échéances,
  `isInvoiceIssued`).
- `lib/invoice-totals.ts` : **seule** implémentation du calcul des totaux.
- `lib/company.ts` : coordonnées de l'entreprise imprimées sur les documents
  et signant les emails — doivent rester en phase avec le pied de page de
  `public/images/Picture2.png`, qui est ce que le client voit réellement.
- `lib/pdf/generator.ts` (dessin, partagé), `lib/pdf/server.ts` (rendu
  serveur), `lib/pdf/layout.ts` (géométrie).
- `lib/email/mailer.ts` (config SMTP), `lib/email/invoice-message.ts`
  (contenu de l'email).
- `components/invoices/email-dialog.tsx` : écran de vérification avant envoi.
- `scripts/check-smtp.mjs` : diagnostic SMTP sans envoi.
- `lib/seed-data.ts` : données de démonstration (seed désactivé par défaut).
- `prisma/schema.prisma` + `prisma/migrations/` : schéma et historique
  (6 migrations).
- `proxy.ts` : protection des routes, renouvellement de session.
- `.github/workflows/ci.yml` : pipeline de vérification.

## Consignes de reprise

- Ne jamais committer `.env` ni afficher les valeurs des URLs Supabase ou des
  identifiants SMTP.
- `DATABASE_URL` pour l'application, `DIRECT_DATABASE_URL` pour les
  migrations.
- Ne pas réintroduire d'accès Prisma dans les composants client.
- Après toute modification du schéma : `npm run db:generate`, puis typecheck
  et build.
- Les totaux sont **toujours** recalculés côté serveur : ne jamais faire
  confiance aux montants envoyés par le client.
- Avant de modifier la config SMTP ou tester un envoi : `npm run check:smtp`
  d'abord, jamais un envoi direct dans l'UI sans savoir si les identifiants
  sont valides.
- Toute nouvelle migration de schéma : vérifier qu'elle rejoue sur une base
  vierge via `npm run test:db:prepare` avant de l'appliquer en production.
