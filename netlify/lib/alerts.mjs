// Ortak gönderim mantığı: verilen risk verisine göre her köyün kayıtlılarına mesaj hazırlar/gönderir.
import { getStore } from "@netlify/blobs";
import { sendSms } from "./kivilcim.mjs";
import { alertMessage } from "./mesajlar.mjs";

export async function loadSubscribers() {
  const store = getStore({ name: "subscribers", consistency: "strong" });
  const { blobs } = await store.list();
  const all = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
  return all.filter(Boolean);
}

// onlyLevels: hangi seviyelerde gönderilsin (ör. ["red","yellow"])
// shouldSend(loc): ek kontrol (ör. bugün zaten gönderildi mi)
export async function sendAlerts(riskData, { send = false, onlyLevels = ["red", "yellow"], shouldSend } = {}) {
  const subscribers = await loadSubscribers();
  const results = [];
  for (const loc of riskData.locations) {
    const text = alertMessage(loc);
    const numbers = subscribers.filter((s) => s.village === loc.id).map((s) => s.phone);
    const item = { village: loc.name, id: loc.id, level: loc.peak, recipients: numbers.length, text, length: text ? text.length : 0 };
    if (!text || !onlyLevels.includes(loc.peak)) {
      results.push({ ...item, skipped: "Bu seviyede mesaj gönderilmiyor." });
      continue;
    }
    if (shouldSend && !(await shouldSend(loc))) {
      results.push({ ...item, skipped: "Bugün bu köye bu seviyede mesaj zaten gönderildi." });
      continue;
    }
    if (!send) {
      results.push({ ...item, preview: true });
      continue;
    }
    try {
      results.push({ ...item, ...(await sendSms(numbers, text)) });
    } catch (err) {
      results.push({ ...item, error: err.message });
    }
  }
  return { totalSubscribers: subscribers.length, results };
}

