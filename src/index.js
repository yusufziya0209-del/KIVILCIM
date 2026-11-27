// Kıvılcım – Cloudflare Worker
// Sayfalar (public/ klasörü) Cloudflare tarafından doğrudan sunulur; bu dosya /api/... adreslerini
// ve saatlik otomatik kontrolü yönetir. Veriler KV'de saklanır (bağlantı adı: KV).
import {
  LOCATIONS, LEVELS, getForecast, getHistory, getScenario, istanbulHour, normalizePhone, sendSms, json,
} from "./kivilcim.js";
import { alertMessage } from "./mesajlar.js";

const CONSENT_VERSION = "v1";
const DEMO_MINUTES = 120; // demo modu 2 saat sonra kendiliğinden kapanır
const SEND_FROM_HOUR = 7; // otomatik SMS sadece 07:00–20:00 arası
const SEND_UNTIL_HOUR = 20;

// ---------------------------------------------------------------------------
// Kayıtlar (KV)
// ---------------------------------------------------------------------------
async function loadSubscribers(env) {
  const out = [];
  let cursor;
  do {
    const page = await env.KV.list({ prefix: "sub:", cursor });
    const values = await Promise.all(page.keys.map((k) => env.KV.get(k.name, { type: "json" })));
    out.push(...values.filter(Boolean));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return out;
}

// "905321234567" → "0532 *** ** 67" (panelde numaranın tamamı gösterilmez)
function maskPhone(p) {
  const d = String(p).slice(2); // 5321234567
  return `0${d.slice(0, 3)} *** ** ${d.slice(-2)}`;
}

async function getDemo(env) {
  const demo = await env.KV.get("settings:demo", { type: "json" });
  return demo && Date.parse(demo.until) > Date.now() ? demo : null;
}

// ---------------------------------------------------------------------------
// Mesaj gönderimi
// ---------------------------------------------------------------------------
async function sendAlerts(env, riskData, { send = false, onlyLevels = ["red", "yellow"], shouldSend } = {}) {
  const subscribers = await loadSubscribers(env);
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
      results.push({ ...item, ...(await sendSms(env, numbers, text)) });
    } catch (err) {
      results.push({ ...item, error: err.message });
    }
  }
  return { totalSubscribers: subscribers.length, results };
}

// ---------------------------------------------------------------------------
// /api/risk
// ---------------------------------------------------------------------------
async function apiRisk(env) {
  const demo = await getDemo(env);
  if (demo) {
    const data = demo.mode === "history" ? await getHistory(demo.date) : getScenario(demo);
    return json({ demo: true, generatedAt: new Date().toISOString(), ...data }, 200, { "Cache-Control": "no-store" });
  }
  const data = await getForecast();
  return json({ demo: false, generatedAt: new Date().toISOString(), ...data }, 200, { "Cache-Control": "public, max-age=300" });
}

// ---------------------------------------------------------------------------
// /api/signup  /api/unsubscribe
// ---------------------------------------------------------------------------
async function apiSignup(req, env) {
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Geçersiz istek." }, 400);
  }
  if (body.website) return json({ ok: true }); // bot tuzağı
  const phone = normalizePhone(body.phone);
  if (!phone) return json({ error: "Lütfen geçerli bir cep telefonu numarası girin (05XX XXX XX XX)." }, 400);
  const village = LOCATIONS.find((l) => l.id === body.village);
  if (!village) return json({ error: "Lütfen köyünüzü / mahallenizi seçin." }, 400);
  if (body.consent !== true) return json({ error: "Kayıt için onay kutusunu işaretlemeniz gerekiyor." }, 400);

  await env.KV.put(`sub:${phone}`, JSON.stringify({
    phone, village: village.id, consentAt: new Date().toISOString(), consentVersion: CONSENT_VERSION,
  }));
  return json({ ok: true, message: `Kaydınız alındı. ${village.name} için riskli günlerde SMS ile haber vereceğiz.` });
}

async function apiUnsubscribe(req, env) {
  let body = {};
  try {
    body = await req.json();
  } catch {}
  const phone = normalizePhone(body.phone);
  if (!phone) return json({ error: "Lütfen geçerli bir cep telefonu numarası girin." }, 400);
  await env.KV.delete(`sub:${phone}`);
  return json({ ok: true, message: "Numaranız listeden çıkarıldı ve bilgileriniz silindi." });
}

// ---------------------------------------------------------------------------
// /api/admin  (demo paneli)
// ---------------------------------------------------------------------------
async function getData(body) {
  if (body.mode === "history") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || "")) throw new Error("Tarih seçin.");
    return getHistory(body.date);
  }
  if (body.mode === "scenario") {
    for (const k of ["temp", "humidity", "wind"]) {
      if (body[k] === "" || body[k] == null || isNaN(Number(body[k]))) throw new Error("Senaryo için sıcaklık, nem ve rüzgârı girin.");
    }
    return getScenario(body);
  }
  return getForecast();
}

async function apiAdmin(req, env) {
  const expected = env.ADMIN_PASSWORD;
  if (!expected) return json({ error: "Cloudflare'da ADMIN_PASSWORD tanımlanmamış." }, 500);
  let body = {};
  try {
    body = await req.json();
  } catch {}
  if (body.password !== expected) return json({ error: "Şifre yanlış." }, 401);

  try {
    switch (body.action) {
      case "status": {
        const subs = await loadSubscribers(env);
        const byVillage = {};
        for (const s of subs) byVillage[s.village] = (byVillage[s.village] || 0) + 1;
        const list = subs
          .sort((a, b) => (a.consentAt < b.consentAt ? 1 : -1))
          .map((s) => ({ phone: maskPhone(s.phone), village: s.village, at: s.consentAt }));
        return json({
          subscribers: subs.length,
          byVillage,
          list,
          demo: await getDemo(env),
          smsReady: Boolean(env.ILETIMERKEZI_KEY && env.ILETIMERKEZI_HASH),
          sender: env.SMS_SENDER || "APITEST",
        });
      }
      case "preview":
      case "send": {
        const data = await getData(body);
        const out = await sendAlerts(env, data, { send: body.action === "send" });
        return json({
          source: data.source,
          levels: data.locations.map((l) => ({ name: l.name, peak: l.peak, window: l.window, now: l.now })),
          ...out,
        });
      }
      case "demoOn": {
        if (body.mode !== "history" && body.mode !== "scenario") throw new Error("Demo için 'Geçmiş gün' ya da 'Senaryo' seçin.");
        await getData(body); // verinin alınabildiğinden emin ol
        const until = new Date(Date.now() + DEMO_MINUTES * 60000).toISOString();
        const demo = { mode: body.mode, date: body.date, temp: body.temp, humidity: body.humidity, wind: body.wind, until };
        await env.KV.put("settings:demo", JSON.stringify(demo), { expirationTtl: DEMO_MINUTES * 60 });
        return json({ ok: true, demo });
      }
      case "demoOff": {
        await env.KV.delete("settings:demo");
        return json({ ok: true });
      }
      default:
        return json({ error: "Bilinmeyen işlem." }, 400);
    }
  } catch (err) {
    return json({ error: err.message }, 400);
  }
}

// ---------------------------------------------------------------------------
// Saatlik otomatik kontrol (cron)
// ---------------------------------------------------------------------------
async function hourlyCheck(env) {
  const now = istanbulHour();
  const hour = Number(now.slice(11, 13));
  if (hour < SEND_FROM_HOUR || hour > SEND_UNTIL_HOUR) return { skipped: `Saat ${hour}:00 – gece gönderim yok.` };

  const today = now.slice(0, 10);
  const data = await getForecast();
  const out = await sendAlerts(env, data, {
    send: true,
    shouldSend: async (loc) => {
      const prev = await env.KV.get(`sent:${today}:${loc.id}`);
      return !prev || LEVELS[loc.peak].rank > LEVELS[prev].rank;
    },
  });
  for (const r of out.results) {
    if (!r.skipped && !r.error && !r.dryRun && !r.preview && r.recipients > 0) {
      await env.KV.put(`sent:${today}:${r.id}`, r.level, { expirationTtl: 3 * 86400 });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Giriş noktası
// ---------------------------------------------------------------------------
const ROUTES = {
  "/api/risk": { GET: (req, env) => apiRisk(env) },
  "/api/signup": { POST: apiSignup },
  "/api/unsubscribe": { POST: apiUnsubscribe },
  "/api/admin": { POST: apiAdmin },
};

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const route = ROUTES[url.pathname];
    if (route) {
      const handler = route[req.method];
      if (!handler) return json({ error: "Bu yöntem desteklenmiyor." }, 405);
      try {
        return await handler(req, env);
      } catch (err) {
        return json({ error: err.message }, 502);
      }
    }
    return env.ASSETS.fetch(req); // HTML sayfaları
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(hourlyCheck(env).then((r) => console.log(JSON.stringify(r))));
  },
};
