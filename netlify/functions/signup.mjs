// POST /api/signup → SMS uyarılarına kayıt.
// Sadece telefon numarası, köy ve onay zamanı saklanır (KVKK).
import { getStore } from "@netlify/blobs";
import { LOCATIONS, normalizePhone, json } from "../lib/kivilcim.mjs";

export const CONSENT_VERSION = "v1";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Sadece POST" }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Geçersiz istek." }, 400);
  }

  if (body.website) return json({ ok: true }); // bot tuzağı (gizli alan doluysa sessizce yok say)

  const phone = normalizePhone(body.phone);
  if (!phone) return json({ error: "Lütfen geçerli bir cep telefonu numarası girin (05XX XXX XX XX)." }, 400);

  const village = LOCATIONS.find((l) => l.id === body.village);
  if (!village) return json({ error: "Lütfen köyünüzü / mahallenizi seçin." }, 400);

  if (body.consent !== true) return json({ error: "Kayıt için onay kutusunu işaretlemeniz gerekiyor." }, 400);

  const store = getStore({ name: "subscribers", consistency: "strong" });
  await store.setJSON(phone, {
    phone,
    village: village.id,
    consentAt: new Date().toISOString(),
    consentVersion: CONSENT_VERSION,
  });

  return json({ ok: true, message: `Kaydınız alındı. ${village.name} için riskli günlerde SMS ile haber vereceğiz.` });
};

export const config = { path: "/api/signup" };
