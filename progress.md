# Progression du projet

Dernière mise à jour : 2026-09-24

## Objectif

Migrer la gestion des clients et des factures depuis SQLite/localStorage vers PostgreSQL Supabase, avec le schéma PostgreSQL `facturation`.

## Fait

- Remote Git `origin` configuré vers `https://github.com/sirius-assurances/Gestion_facture_gladiama.git`.
- Audit initial réalisé en lecture seule.
- ORM identifié : Prisma ORM et Prisma Client `7.10.0`.
- Schéma Prisma basculé de `sqlite` vers `postgresql`.
- Namespace PostgreSQL `facturation` ajouté au schéma Prisma.
- Modèles conservés : `Client`, `Invoice`, `InvoiceItem`.
- Champ `dueDate` ajouté à `Invoice` pour correspondre à l'interface existante.
- Numéro de facture rendu unique.
- Adaptateur Prisma PostgreSQL installé : `@prisma/adapter-pg` et `pg`.
- Client Prisma PostgreSQL ajouté dans `lib/prisma.ts`.
- Server Actions ajoutées dans `app/actions/billing.ts` pour :
  - lire les clients et factures ;
  - créer et modifier les clients ;
  - supprimer les clients ;
  - créer et modifier les factures ;
  - changer le statut des factures ;
  - supprimer les factures.
- Initialisation des données par défaut ajoutée au premier chargement de la base vide.
- Verrou ajouté pour éviter deux initialisations concurrentes.
- Les écrans clients et factures utilisent maintenant Prisma via Server Actions.
- Les écrans applicatifs ne dépendent plus de `localStorage` pour les clients et factures.
- Migration SQL initiale ajoutée dans `prisma/migrations/0001_init_facturation/migration.sql`.
- `prisma/migrations/migration_lock.toml` configuré pour PostgreSQL.
- `.env.example` documente `DATABASE_URL` et `DIRECT_DATABASE_URL` sans secret.
- La migration `0001_init_facturation` a été appliquée avec succès dans Supabase via le pooler session mode (`:5432`).
- La migration `0002_precision_indexes` a été appliquée avec succès.
- Les montants sont maintenant stockés en `Decimal`/`numeric` avec deux décimales.
- Les quantités sont stockées avec trois décimales.
- Des index ont été ajoutés sur les clients, relations de factures, statuts, dates et échéances.
- La génération des numéros de facture est protégée par un verrou transactionnel PostgreSQL.
- Supabase Auth intégré avec sessions SSR par cookies.
- Proxy Next.js ajouté pour protéger toutes les routes sauf `/login`.
- Page de connexion Supabase ajoutée dans `app/login/page.tsx`.
- Bouton global de déconnexion ajouté.
- Toutes les Server Actions de facturation vérifient maintenant la session utilisateur.
- Logo original `public/images/logo-gladiama.png` branché comme logo principal des PDF.
- `prisma migrate status` confirme que la base Supabase est à jour.
- Le rôle applicatif a été vérifié en lecture et ses privilèges CRUD sur `Client`, `Invoice` et `InvoiceItem` sont valides.
- La vérification TypeScript passe après la migration.
- Prisma Client généré avec succès.
- ESLint, TypeScript et le build Next.js ont été validés avant l'ajout de la migration SQL finale.

## État actuel

- La base Supabase est joignable via le pooler session mode et le schéma `facturation` est initialisé.
- La cible confirmée est le projet Supabase existant, avec un nouveau schéma PostgreSQL `facturation`.
- Le schéma `facturation` et le rôle applicatif dédié ont été créés dans Supabase.
- Le rôle applicatif possède `USAGE` sur `facturation` et un `search_path` configuré vers ce schéma.
- `DATABASE_URL` local pointe maintenant vers le pooler Supabase du rôle applicatif, avec `schema=facturation`.
- Les informations de connexion ne sont pas enregistrées dans ce fichier de suivi.
- Le fichier `.env` local contient les connexions Supabase runtime et migration, sans être suivi par Git.
- Les variables Auth `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` doivent être ajoutées dans `.env`.
- Les variables Auth Supabase sont maintenant configurées localement.
- La migration SQL initiale est appliquée à Supabase.
- Aucun système d'authentification n'est encore configuré.
- Les PDF et images restent générés/téléchargés côté navigateur et stockés dans `public/images`.

## À faire

1. Pour les prochaines migrations, conserver une connexion administrateur dans `DIRECT_DATABASE_URL`, avec `schema=facturation`.
2. Appliquer les prochaines migrations :

   ```bash
   npx prisma migrate deploy
   ```

3. Vérifier les droits du rôle applicatif sur les tables créées par la migration :

   ```sql
   grant select, insert, update, delete on all tables in schema facturation to facturation_app;
   grant usage, select on all sequences in schema facturation to facturation_app;
   ```

4. Lancer l'application et tester les parcours suivants :
   - tableau de bord ;
   - création, modification et suppression d'un client ;
   - création d'une facture ;
   - modification du statut d'une facture ;
   - modification et suppression d'une facture ;
   - génération et partage d'un PDF.
5. Régénérer Prisma après toute modification de `prisma/schema.prisma` :

   ```bash
   npm run db:generate
   ```

7. Créer le premier utilisateur dans Supabase Authentication.
8. Décider si les logos/PDF doivent migrer vers Supabase Storage.
9. Ajouter des tests d'intégration pour les Server Actions et les relations Prisma.
10. Prévoir Node.js 22+ pour suivre la version supportée par `@supabase/supabase-js`.

## Fichiers principaux

- `prisma/schema.prisma` : modèle PostgreSQL et schéma `facturation`.
- `prisma7.config.ts` : configuration Prisma et URL directe pour les migrations.
- `lib/prisma.ts` : singleton Prisma avec l'adaptateur PostgreSQL.
- `app/actions/billing.ts` : accès serveur aux clients et factures.
- `lib/invoice-storage.ts` : types UI et fonctions de calcul encore partagées.
- `prisma/migrations/0001_init_facturation/migration.sql` : migration initiale.
- `.env.example` : noms et formats attendus des variables, sans secret.
- `.env` : configuration locale Supabase à compléter, fichier ignoré par Git.
- `lib/supabase/client.ts` et `lib/supabase/server.ts` : clients Supabase Auth.
- `proxy.ts` : renouvellement de session et protection des routes.
- `app/login/page.tsx` : connexion utilisateur.

## Consignes de reprise

- Ne jamais committer `.env` ni afficher les valeurs des URLs Supabase.
- Utiliser `DATABASE_URL` pour l'application et `DIRECT_DATABASE_URL` pour les migrations Prisma.
- Ne pas réintroduire les accès Prisma dans les composants client.
- Après toute modification du schéma, lancer `npm run db:generate`, puis vérifier TypeScript et le build.