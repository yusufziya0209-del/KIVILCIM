# Kıvılcım – Orman yangını erken uyarı sitesi

AGÜ GLB300 Societal Impact projesi. Site, Seydikemer–Fethiye için saatlik yangın riskini hesaplar,
kayıt olan kişilere riskli günlerde SMS gönderir ve final sunumu için bir **demo paneli** içerir.

Site **Cloudflare Workers** üzerinde çalışır (Netlify Türkiye'den erişilemediği için taşındı).

## Kurulum
1. Cloudflare panelinde **Workers & Pages → Create → Import a repository** → GitHub → `KIVILCIM`.
2. Proje adı **`kivilcim-uyari`** olmalı (wrangler.toml'daki isimle aynı). Diğer ayarlar varsayılan kalsın → **Deploy**.
3. **Settings → Variables and Secrets → Add**: `ADMIN_PASSWORD` (tür: Secret).
4. SMS için (İleti Merkezi hesabı onaylanınca) aynı yerden: `ILETIMERKEZI_KEY`, `ILETIMERKEZI_HASH`, `SMS_SENDER`.
   Bunlar yokken site **deneme modunda** çalışır: her şey işler ama gerçek SMS gitmez.

GitHub'a yapılan her değişiklik Cloudflare'da otomatik olarak yayına alınır.

## Final günü demo akışı
1. `/admin.html` → şifre → **Geçmiş bir gün** (örn. 2021-07-29) ya da **Senaryo** → **Önizle**.
2. **Siteyi demo moduna al** → ana sayfa Kırmızı'ya döner, üstte "DEMO MODU" yazar.
3. Jüri QR kodla siteye girip numarasını kaydeder.
4. **SMS gönder** → riskli köylerdeki kayıtlılara mesaj gider.
5. Bitince **Demo modunu kapat** (2 saat sonra kendiliğinden de kapanır).

## Dosyalar

| Dosya | Ne işe yarar | Kim düzenler |
|---|---|---|
| `public/index.html` | Ana sayfa | İremnaz / Yusuf |
| `public/admin.html` | Demo paneli | – |
| `public/kvkk.html` | Aydınlatma metni (köşeli parantezleri doldurun) | Yusuf |
| `src/kivilcim.js` | Köyler, koordinatlar, **risk eşikleri**, hava verisi, SMS | Selen / Emirhan |
| `src/mesajlar.js` | **SMS metinleri** | Yusuf |
| `src/index.js` | API adresleri (`/api/risk`, `/api/signup`, `/api/unsubscribe`, `/api/admin`) ve saatlik kontrol | – |
| `wrangler.toml` | Cloudflare ayarları (KV deposu, her saat başı çalışma) | – |

## Risk kuralları (proje önerisindeki gibi)
- **Kırmızı:** nem < %20 ve rüzgâr > 30 km/s
- **Sarı:** sıcaklık > 30 °C, nem < %30 ve rüzgâr > 30 km/s (OGM 30-30-30)
- **Yeşil:** diğer tüm durumlar

Hava verisi: Open-Meteo (ücretsiz, anahtar gerekmez). Kayıtlar Cloudflare KV'de saklanır; yalnızca telefon,
köy ve onay zamanı tutulur. Otomatik SMS yalnızca 07:00–20:00 arasında, aynı gün aynı köye bir kez gider
(risk Sarı'dan Kırmızı'ya çıkarsa yeniden gider).
