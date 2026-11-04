/**
 * Split out from signature-card.ts on purpose: that file reads from disk
 * (node:fs/promises) and must stay server-only, but lib/email/invoice-message.ts
 * — which needs just this id to build the `cid:` reference — is also
 * imported from at least one client component (the client edit form uses
 * its parseRecipients). Pulling in a Node-only module there broke the build
 * ("the chunking context does not support external modules"), since a
 * bundler can't tree-shake away an import at the top of a file just because
 * only one of its exports is actually used.
 */
export const SIGNATURE_CARD_FILENAME = "signature-abdoulaye.png";
export const SIGNATURE_CARD_CID = "gladiama-signature-card";
