# Progression du projet

Dernière mise à jour : 2026-10-04

## Objectif

Application de facturation GLADIAMA SUARL : gestion des clients, des factures
et génération des PDF, sur PostgreSQL Supabase (schéma `facturation`),
déployée sur Vercel.

## État actuel

L'application est **en production et fonctionnelle**. Base Supabase à jour
(5 migrations appliquées), authentification Supabase par cookies, deux comptes
utilisateurs aux droits identiques.

Qualité : 46 tests unitaires, 6 tests d'intégration (vraie base), 7 tests E2E
(vrai navigateur), et un CI GitHub Actions qui exécute tout à chaque push.

## Démarrer

```bash
npm run dev          # ⚠️ voir le piège des ports ci-dessous
npm test             # tests unitaires (rapides, sans base)
npm run test:e2e     # E2E Playwright (nécessite E2E_EMAIL / E2E_PASSWORD)

npm run test:db:up        # Postgres jetable (Docker)
npm run test:db:prepare    # applique les migrations dessus
npm run test:integration   # tests d'intégration
npm run test:db:down       # arrête et supprime la base de test
```

## Pièges connus (chèrement acquis)

- **Port de dev** : une autre application de la machine (BILMS) occupe le port
  3000. Next se décale alors sur **3001**. Vérifier le titre de la page avant
  de conclure à un bug d'authentification : se connecter à la mauvaise
  application donne « Invalid email or password ».
- **PDF sur Safari iOS** : Safari n'affiche pas de PDF dans une iframe, et ne
  résout pas une URL `blob:` créée dans un autre onglet (page blanche). D'où
  l'upload vers Supabase Storage puis l'ouverture d'une URL signée `https`.
  De plus `window.open()` doit être appelé **avant** tout `await`, sinon
  Safari le bloque comme pop-up.
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

## Incident de production (octobre 2026)

Les factures **avec TVA** ne pouvaient être ni téléchargées ni visualisées.
La table du PDF déclarait 4 en-têtes mais seulement 4 bornes de colonnes au
lieu de 5 : la dernière coordonnée valait `NaN` et jsPDF rejetait tout le
document. Les factures sans TVA fonctionnaient, ce qui a masqué le problème.

Deux défauts connexes falsifiaient les documents envoyés aux clients :
le numéro prévisualisé venait du nombre de lignes (N°4) au lieu de la séquence
Postgres (N°26), et les références marché/contrat étaient codées en dur avec
celles d'un seul client pour toutes les factures.

Ces trois défauts sont corrigés, vérifiés sur la base réelle, et couverts par
des tests.

## Reste à faire

1. Exécuter les E2E dans le CI (nécessite une instance accessible et des
   identifiants de test en secrets GitHub).
2. Le test E2E `invoice-lifecycle.spec.ts` est ignoré par défaut : il crée une
   facture et consommerait un numéro du registre réel. L'activer avec
   `E2E_ALLOW_WRITES=1` contre une base jetable.
3. Le numéro affiché avant enregistrement reste une prédiction : deux
   créations simultanées pourraient produire un PDF au numéro déjà pris. Le
   correctif complet serait d'enregistrer avant d'autoriser le téléchargement.
4. Cosmétique : 3 avertissements ESLint `<img>` vs `next/image`, et le champ
   `defaultProduct` présent en base mais inutilisé.
5. Latent, sans impact à deux utilisateurs : plafond ~1 Mo sur l'upload PDF
   (base64 via Server Action), liste client du menu déroulant non paginée,
   pas de limitation de débit applicative.

## Fichiers principaux

- `app/actions/billing.ts` : toutes les Server Actions (lecture, écriture,
  pagination, métriques du tableau de bord, PDF). Chacune vérifie la session.
- `lib/invoice.ts` : modèle métier (types, statuts, échéances).
- `lib/invoice-totals.ts` : **seule** implémentation du calcul des totaux.
- `lib/company.ts` : coordonnées de l'entreprise imprimées sur les documents.
- `lib/pdf/generator.ts` et `lib/pdf/layout.ts` : génération et géométrie du PDF.
- `lib/seed-data.ts` : données de démonstration (seed désactivé par défaut).
- `prisma/schema.prisma` + `prisma/migrations/` : schéma et historique.
- `proxy.ts` : protection des routes, renouvellement de session.
- `.github/workflows/ci.yml` : pipeline de vérification.

## Consignes de reprise

- Ne jamais committer `.env` ni afficher les valeurs des URLs Supabase.
- `DATABASE_URL` pour l'application, `DIRECT_DATABASE_URL` pour les migrations.
- Ne pas réintroduire d'accès Prisma dans les composants client.
- Après toute modification du schéma : `npm run db:generate`, puis typecheck
  et build.
- Les totaux sont **toujours** recalculés côté serveur : ne jamais faire
  confiance aux montants envoyés par le client.
