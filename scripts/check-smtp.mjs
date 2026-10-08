// Checks the SMTP settings in .env by opening a real connection and
// authenticating — without sending anything.
//
// Worth its own script because the failure that matters here is silent until
// you try: mailbox providers are withdrawing password authentication, so a
// correctly typed app password can still be refused by the account. This
// says so in seconds, and quotes the server's own words.
import nodemailer from "nodemailer";

const PRESETS = {
  gmail: { host: "smtp.gmail.com", port: 465 },
  outlook: { host: "smtp-mail.outlook.com", port: 587 },
  hotmail: { host: "smtp-mail.outlook.com", port: 587 },
  resend: { host: "smtp.resend.com", port: 465 },
};

const service = process.env.SMTP_SERVICE?.trim().toLowerCase();
const preset = service ? PRESETS[service] : undefined;
const host = process.env.SMTP_HOST?.trim() || preset?.host;
const port = Number(process.env.SMTP_PORT?.trim() || preset?.port || 587);
const user = process.env.SMTP_USER?.trim();
const pass = process.env.SMTP_PASSWORD;

const missing = [
  !host && "SMTP_HOST (ou SMTP_SERVICE)",
  !user && "SMTP_USER",
  !pass && "SMTP_PASSWORD",
].filter(Boolean);

if (missing.length) {
  console.error(`Configuration incomplète. Manquant : ${missing.join(", ")}`);
  process.exit(1);
}

console.log(`Serveur   : ${host}:${port} (${port === 465 ? "TLS direct" : "STARTTLS"})`);
console.log(`Compte    : ${user}`);
console.log("Connexion…\n");

const transport = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
});

try {
  await transport.verify();
  console.log("OK — le serveur accepte ces identifiants. L'envoi fonctionnera.");
} catch (error) {
  console.error("ÉCHEC —", error.message);

  // The three refusals worth telling apart, because the fix differs.
  const text = String(error.message);
  if (/5\.7\.9|basic authentication is disabled|authentication unsuccessful/i.test(text)) {
    console.error(
      "\nLe compte refuse l'authentification par mot de passe. C'est une politique\n" +
        "du fournisseur, pas une erreur de saisie : il faut une autre boîte, ou un\n" +
        "domaine à vous via un service d'envoi.",
    );
  } else if (/535|invalid credentials|username and password not accepted/i.test(text)) {
    console.error(
      "\nIdentifiants refusés. Vérifiez qu'il s'agit bien d'un mot de passe\n" +
        "d'application (pas celui du compte) et qu'il est copié sans espaces.",
    );
  } else if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(text)) {
    console.error("\nServeur injoignable : vérifiez l'hôte, le port, et votre connexion.");
  }
  process.exitCode = 1;
}
