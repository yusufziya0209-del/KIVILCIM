// Her saat başı kendiliğinden çalışır (Netlify zamanlanmış görev).
// 07:00–20:00 arasında, canlı tahmine göre riskli (Sarı/Kırmızı) köylerin kayıtlılarına SMS gönderir.
// Aynı gün aynı köye aynı seviyede ikinci kez göndermez; risk Sarı'dan Kırmızı'ya çıkarsa yeniden gönderir.
import { getStore } from "@netlify/blobs";
import { getForecast, istanbulHour, LEVELS } from "../lib/kivilcim.mjs";
import { sendAlerts } from "../lib/alerts.mjs";

const SEND_FROM_HOUR = 7;
const SEND_UNTIL_HOUR = 20;

export default async () => {
  const now = istanbulHour();
  const hour = Number(now.slice(11, 13));
  if (hour < SEND_FROM_HOUR || hour > SEND_UNTIL_HOUR) {
    console.log(`Saat ${hour}:00 – gece saatlerinde gönderim yapılmıyor.`);
    return;
  }

  const today = now.slice(0, 10);
  const state = getStore({ name: "sent-log", consistency: "strong" });
  const data = await getForecast();

  const out = await sendAlerts(data, {
    send: true,
    onlyLevels: ["red", "yellow"],
    shouldSend: async (loc) => {
      const prev = await state.get(`${today}:${loc.id}`);
      return !prev || LEVELS[loc.peak].rank > LEVELS[prev].rank;
    },
  });

  for (const r of out.results) {
    if (!r.skipped && !r.error && !r.dryRun && !r.preview && r.recipients > 0) {
      await state.set(`${today}:${r.id}`, r.level);
    }
  }
  console.log(JSON.stringify(out));
};

export const config = { schedule: "@hourly" };
