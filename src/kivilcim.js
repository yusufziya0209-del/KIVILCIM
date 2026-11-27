// Kıvılcım – ortak kod: köyler, risk kuralları, hava verisi, SMS gönderimi.
// Eşik değerlerini veya köyleri değiştirmek için sadece bu dosyanın en üstünü düzenlemek yeter.

// ---------------------------------------------------------------------------
// 1) KÖYLER / NOKTALAR (koordinatlar yaklaşık; Selen/Emirhan kontrol edebilir)
// ---------------------------------------------------------------------------
export const LOCATIONS = [
  // "yerde": mesajlarda kullanılan "-de/-da" hâli (ör. "Kınık'ta")
  { id: "seydikemer", name: "Seydikemer merkez", yerde: "Seydikemer'de", lat: 36.65, lon: 29.35 },
  { id: "esen", name: "Eşen", yerde: "Eşen'de", lat: 36.43, lon: 29.27 },
  { id: "kinik", name: "Kınık", yerde: "Kınık'ta", lat: 36.36, lon: 29.32 },
  { id: "fethiye", name: "Fethiye", yerde: "Fethiye'de", lat: 36.62, lon: 29.12 },
];

// ---------------------------------------------------------------------------
// 2) RİSK KURALLARI (proje önerisindeki kurallar)
//    Kırmızı: nem < %20 VE rüzgâr > 30 km/s
//    Sarı:    sıcaklık > 30 °C VE nem < %30 VE rüzgâr > 30 km/s  (OGM 30-30-30)
//    Diğer her durum: Yeşil
// ---------------------------------------------------------------------------
export const RULES = {
  red: { maxHumidity: 20, minWind: 30 },
  yellow: { minTemp: 30, maxHumidity: 30, minWind: 30 },
};

export const LEVELS = {
  green: { rank: 0, label: "Yeşil", name: "Normal" },
  yellow: { rank: 1, label: "Sarı", name: "Yüksek" },
  red: { rank: 2, label: "Kırmızı", name: "Kritik" },
};

export function riskLevel(temp, humidity, wind) {
  if (humidity < RULES.red.maxHumidity && wind > RULES.red.minWind) return "red";
  if (temp > RULES.yellow.minTemp && humidity < RULES.yellow.maxHumidity && wind > RULES.yellow.minWind) return "yellow";
  return "green";
}

// ---------------------------------------------------------------------------
// 3) HAVA VERİSİ (Open-Meteo, ücretsiz, anahtar gerekmez)
// ---------------------------------------------------------------------------
const VARS = "temperature_2m,relative_humidity_2m,wind_speed_10m";
const TZ = "Europe%2FIstanbul";

function coords() {
  return {
    lat: LOCATIONS.map((l) => l.lat).join(","),
    lon: LOCATIONS.map((l) => l.lon).join(","),
  };
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Hava verisi alınamadı (Open-Meteo ${res.status})`);
  return res.json();
}

// İstanbul saatine göre "2026-11-27T15:00" biçiminde şimdiki saat
export function istanbulHour(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:00`;
}

// Bir noktanın 24 saatlik verisinden özet çıkarır
function summarize(loc, hours) {
  let peak = "green";
  for (const h of hours) if (LEVELS[h.level].rank > LEVELS[peak].rank) peak = h.level;

  // En yüksek riskin ilk kesintisiz zaman aralığı (örn. 12:00–18:00)
  let window = null;
  if (peak !== "green") {
    const start = hours.findIndex((h) => h.level === peak);
    let end = start;
    while (end + 1 < hours.length && hours[end + 1].level === peak) end++;
    window = { from: hours[start].time.slice(11, 16), to: nextHour(hours[end].time) };
  }

  // Riskin tekrar Yeşil'e döndüğü ilk saat
  let safeFrom = null;
  if (peak !== "green") {
    const lastRisky = hours.map((h) => h.level !== "green").lastIndexOf(true);
    const firstRisky = hours.findIndex((h) => h.level !== "green");
    const after = hours.findIndex((h, i) => i > firstRisky && h.level === "green");
    if (after !== -1 && after <= lastRisky + 1) safeFrom = hours[after].time;
  }

  return { ...loc, now: hours[0], peak, window, safeFrom, hours };
}

function nextHour(time) {
  const h = (Number(time.slice(11, 13)) + 1) % 24;
  return `${String(h).padStart(2, "0")}:00`;
}

function buildHours(hourly, start, count = 24) {
  const out = [];
  for (let i = start; i < Math.min(start + count, hourly.time.length); i++) {
    const temp = round(hourly.temperature_2m[i]);
    const humidity = round(hourly.relative_humidity_2m[i]);
    const wind = round(hourly.wind_speed_10m[i]);
    out.push({ time: hourly.time[i], temp, humidity, wind, level: riskLevel(temp, humidity, wind) });
  }
  return out;
}

const round = (x) => (x == null ? null : Math.round(x * 10) / 10);
const asArray = (d) => (Array.isArray(d) ? d : [d]);

// Canlı tahmin: şimdiden itibaren 24 saat
export async function getForecast() {
  const { lat, lon } = coords();
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${VARS}&wind_speed_unit=kmh&timezone=${TZ}&forecast_days=3`;
  const data = asArray(await fetchJson(url));
  const now = istanbulHour();
  return {
    source: "Open-Meteo tahmini",
    locations: LOCATIONS.map((loc, i) => {
      const hourly = data[i].hourly;
      let start = hourly.time.findIndex((t) => t >= now);
      if (start < 0) start = 0;
      return summarize(loc, buildHours(hourly, start));
    }),
  };
}

// Geçmiş bir gün (demo için): o günün 00:00–23:00 saatleri
export async function getHistory(date) {
  const { lat, lon } = coords();
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&hourly=${VARS}&wind_speed_unit=kmh&timezone=${TZ}`;
  const data = asArray(await fetchJson(url));
  return {
    source: `Open-Meteo arşivi (${date})`,
    locations: LOCATIONS.map((loc, i) => {
      const s = summarize(loc, buildHours(data[i].hourly, 0));
      // Geçmiş günde "şu an" yerine o günün en riskli saatini göster
      return { ...s, now: s.hours.find((h) => h.level === s.peak) || s.hours[12] || s.now };
    }),
  };
}

// Senaryo (demo için): elle girilen değerler, 12:00–18:00 arası geçerli
export function getScenario({ temp, humidity, wind }) {
  const t = Number(temp), h = Number(humidity), w = Number(wind);
  const today = istanbulHour().slice(0, 10);
  const calm = { temp: Math.min(t, 24), humidity: Math.max(h, 55), wind: Math.min(w, 12) };
  const locations = LOCATIONS.map((loc) => {
    const hours = [];
    for (let i = 0; i < 24; i++) {
      const hh = (12 + i) % 24;
      const active = i < 6; // 12:00–17:59
      const v = active ? { temp: t, humidity: h, wind: w } : calm;
      hours.push({ time: `${today}T${String(hh).padStart(2, "0")}:00`, ...v, level: riskLevel(v.temp, v.humidity, v.wind) });
    }
    return summarize(loc, hours);
  });
  return { source: `Senaryo (elle girilen değerler: ${t} °C, %${h} nem, ${w} km/s rüzgâr)`, locations };
}

// ---------------------------------------------------------------------------
// 4) TELEFON NUMARASI
// ---------------------------------------------------------------------------
// "0532 123 45 67", "+90 532...", "532..." → "905321234567". Geçersizse null.
export function normalizePhone(input) {
  let d = String(input || "").replace(/\D/g, "");
  if (d.startsWith("90") && d.length === 12) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return /^5\d{9}$/.test(d) ? "90" + d : null;
}

// ---------------------------------------------------------------------------
// 5) SMS GÖNDERİMİ (İleti Merkezi)
//    Cloudflare'da (Settings > Variables and Secrets) şu değerler tanımlanınca gerçek SMS gider:
//    ILETIMERKEZI_KEY, ILETIMERKEZI_HASH, SMS_SENDER (onaylı başlık; yoksa APITEST)
//    Tanımlı değilse "deneme modu": SMS gitmez, sadece ne gideceği gösterilir.
// ---------------------------------------------------------------------------
export async function sendSms(env, numbers, text) {
  const key = env.ILETIMERKEZI_KEY;
  const hash = env.ILETIMERKEZI_HASH;
  const sender = env.SMS_SENDER || "APITEST";
  if (!numbers.length) return { dryRun: !key, sender, count: 0, text, note: "Kayıtlı numara yok." };
  if (!key || !hash) return { dryRun: true, sender, count: numbers.length, text };

  const body = {
    request: {
      authentication: { key, hash },
      order: { sender, iys: "0", message: { text, receipents: { number: numbers } } },
    },
  };
  const res = await fetch("https://api.iletimerkezi.com/v1/send-sms/json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  const status = data?.response?.status || {};
  if (String(status.code) !== "200") {
    throw new Error(`SMS gönderilemedi: ${status.code || res.status} ${status.message || ""}`.trim());
  }
  return { dryRun: false, sender, count: numbers.length, orderId: data.response.order?.id, text };
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}
