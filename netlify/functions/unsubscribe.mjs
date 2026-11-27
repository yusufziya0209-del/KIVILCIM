// POST /api/unsubscribe → numarayı listeden ve kayıtlardan tamamen siler.
import { getStore } from "@netlify/blobs";
import { normalizePhone, json } from "../lib/kivilcim.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Sadece POST" }, 405);
  let body = {};
  try {
    body = await req.json();
  } catch {}
  const phone = normalizePhone(body.phone);
  if (!phone) return json({ error: "Lütfen geçerli bir cep telefonu numarası girin." }, 400);

  const store = getStore({ name: "subscribers", consistency: "strong" });
  await store.delete(phone);
  // Numara kayıtlı olsun olmasın aynı cevap verilir (kimin kayıtlı olduğu belli olmasın diye).
  return json({ ok: true, message: "Numaranız listeden çıkarıldı ve bilgileriniz silindi." });
};

export const config = { path: "/api/unsubscribe" };
