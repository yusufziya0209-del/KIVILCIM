// GET /api/risk → sitenin gösterdiği risk verisi.
// Admin panelinden "demo modu" açıldıysa, canlı veri yerine demo verisini döndürür.
import { getStore } from "@netlify/blobs";
import { getForecast, getHistory, getScenario, json } from "../lib/kivilcim.mjs";

export default async () => {
  try {
    const settings = getStore({ name: "settings", consistency: "strong" });
    const demo = await settings.get("demo", { type: "json" });

    if (demo && Date.parse(demo.until) > Date.now()) {
      const data = demo.mode === "history" ? await getHistory(demo.date) : getScenario(demo);
      return json({ demo: true, generatedAt: new Date().toISOString(), ...data }, 200, { "Cache-Control": "no-store" });
    }

    const data = await getForecast();
    return json({ demo: false, generatedAt: new Date().toISOString(), ...data }, 200, {
      "Cache-Control": "public, max-age=300",
    });
  } catch (err) {
    return json({ error: err.message }, 502);
  }
};

export const config = { path: "/api/risk" };
