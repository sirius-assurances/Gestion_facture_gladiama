import { readFile } from "node:fs/promises";
import path from "node:path";
import { SIGNATURE_CARD_FILENAME } from "@/lib/email/signature-card-constants";

/**
 * The director's own signature card, embedded in every invoice email the
 * same way it already appears in his usual correspondence — added
 * alongside the existing legal footer, not in place of it.
 *
 * Sent as an inline attachment referenced by `cid:`, not a hosted-image
 * <img src="https://…">: most mail clients block remote images by default
 * until the recipient explicitly allows them, so a linked image would often
 * render as a blank box. An inline attachment arrives with the message and
 * always renders.
 *
 * Server-only (reads the file from disk) — see signature-card-constants.ts
 * for the id/filename, importable from client code too.
 */
export { SIGNATURE_CARD_CID, SIGNATURE_CARD_FILENAME } from "@/lib/email/signature-card-constants";

const FILE_PATH = path.join(process.cwd(), "public", "images", SIGNATURE_CARD_FILENAME);

let cached: Promise<Buffer> | null = null;

/** Read once per server instance; the file never changes at runtime. */
export function readSignatureCard(): Promise<Buffer> {
  cached ??= readFile(FILE_PATH);
  return cached;
}
