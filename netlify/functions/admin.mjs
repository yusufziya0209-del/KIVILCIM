// POST /api/admin → demo paneli (admin.html) bu adresi kullanır. Şifre: ADMIN_PASSWORD ortam değişkeni.
// İşlemler: status, preview, send, demoOn, demoOff
import { getStore } from "@netlify/blobs";
import { getForecast, getHistory, getScenario, json } from "../lib/kivilcim.mjs";
import { sendAlerts, loadSubscribers } from "../lib/alerts.mjs";

const DEMO_MINUTES = 120; // demo modu 2 saat sonra kendiliğinden kapanır

async function getData(body) {
  if (body.mode === "history") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || "")) throw new Error("Tarih seçin.");
    return getHistory(body.date);
  }
  if (body.mode === "scenario") {
    for (const k of ["temp", "humidity", "wind"]) {
      if (body[k] === "" || isNaN(Number(body[k]))) throw new Error("Senaryo için sıcaklık, nem ve rüzgârı girin.");
    }
    return getScenario(body);
  }
  return getForecast();
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Sadece POST" }, 405);
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return json({ error: "Netlify'da ADMIN_PASSWORD tanımlanmamış." }, 500);

  let body = {};
  try {
    body = await req.json();
  } catch {}
  if (body.password !== expected) return json({ error: "Şifre yanlış." }, 401);

  const settings = getStore({ name: "settings", consistency: "strong" });

  try {
    switch (body.action) {
      case "status": {
        const subs = await loadSubscribers();
        const demo = await settings.get("demo", { type: "json" });
        const byVillage = {};
        for (const s of subs) byVillage[s.village] = (byVillage[s.village] || 0) + 1;
        return json({
          subscribers: subs.length,
          byVillage,
          demo: demo && Date.parse(demo.until) > Date.now() ? demo : null,
          smsReady: Boolean(process.env.ILETIMERKEZI_KEY && process.env.ILETIMERKEZI_HASH),
          sender: process.env.SMS_SENDER || "APITEST",
        });
      }
      case "preview":
      case "send": {
        const data = await getData(body);
        const out = await sendAlerts(data, { send: body.action === "send", onlyLevels: ["red", "yellow"] });
        return json({
          source: data.source,
          levels: data.locations.map((l) => ({ name: l.name, peak: l.peak, window: l.window, now: l.now })),
          ...out,
        });
      }
      case "demoOn": {
        await getData(body); // önce verinin alınabildiğinden emin ol
        const until = new Date(Date.now() + DEMO_MINUTES * 60000).toISOString();
        const demo = { mode: body.mode, date: body.date, temp: body.temp, humidity: body.humidity, wind: body.wind, until };
        if (demo.mode !== "history" && demo.mode !== "scenario") throw new Error("Demo için 'Geçmiş gün' ya da 'Senaryo' seçin.");
        await settings.setJSON("demo", demo);
        return json({ ok: true, demo });
      }
      case "demoOff": {
        await settings.delete("demo");
        return json({ ok: true });
      }
      default:
        return json({ error: "Bilinmeyen işlem." }, 400);
    }
  } catch (err) {
    return json({ error: err.message }, 400);
  }
};

export const config = { path: "/api/admin" };
