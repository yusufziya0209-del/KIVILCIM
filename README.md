# Kıvılcım – Orman yangını erken uyarı sitesi

AGÜ GLB300 Societal Impact projesi. Site, Seydikemer–Fethiye için saatlik yangın riskini hesaplar,
kayıt olan kişilere riskli günlerde SMS gönderir ve final sunumu için bir **demo paneli** içerir.

## Kurulum (kod bilgisi gerekmez, ~20 dakika)

### 1. GitHub'a yükle
1. https://github.com/signup adresinden hesap aç.
2. Sağ üstteki **+** → **New repository**. İsim: `kivilcim`. **Private** seçebilirsin. **Create repository**.
3. Açılan sayfada **"uploading an existing file"** bağlantısına tıkla.
4. Bu zip'i bilgisayarında aç. Açılan `kivilcim` klasörünün **içindekileri** (`public`, `netlify`, `package.json`,
   `netlify.toml`, `README.md`) tarayıcıdaki alana sürükle. (Klasörün kendisini değil, içindekileri!)
5. Aşağıdaki **Commit changes** butonuna bas.

### 2. Netlify'da yayına al
1. https://app.netlify.com/signup → **Sign up with GitHub**.
2. **Add new project** → **Import an existing project** → **GitHub** → izin ver → `kivilcim` deposunu seç.
3. Ayarlara dokunma (her şey `netlify.toml` dosyasından okunur) → **Deploy**.
4. Birkaç dakika sonra site `rastgele-isim.netlify.app` gibi bir adreste açılır.
   **Site configuration → Change site name** ile adı `kivilcim-agu` gibi bir şey yapabilirsin.

### 3. Demo paneli şifresini tanımla
1. Netlify'da **Site configuration → Environment variables → Add a variable**.
2. Key: `ADMIN_PASSWORD`, Value: kendi belirleyeceğiniz bir şifre.
3. **Deploys → Trigger deploy → Deploy site** (değişkenin geçerli olması için).
4. Demo paneli: `https://SİTE-ADRESİ/admin.html`

### 4. SMS'i bağla (İleti Merkezi hesabı onaylanınca)
Aynı yerden üç değişken daha ekleyip yeniden deploy edin:

| Key | Değer |
|---|---|
| `ILETIMERKEZI_KEY` | İleti Merkezi panelindeki API anahtarı |
| `ILETIMERKEZI_HASH` | İleti Merkezi panelindeki API hash |
| `SMS_SENDER` | Onaylanan başlık (örn. `KIVILCIM`). Yazılmazsa `APITEST` kullanılır. |

İleti Merkezi panelinde API erişimini açmayı unutmayın (Ayarlar > Güvenlik > Erişim İzinleri).
Bu değişkenler yokken site **deneme modunda** çalışır: her şey çalışır ama gerçek SMS gitmez.

## Final günü demo akışı
1. `admin.html` → şifre → **Geçmiş bir gün** (örn. 2021-07-29) ya da **Senaryo** seç → **Önizle**.
2. **Siteyi demo moduna al** → ana sayfa Kırmızı'ya döner ve üstte "DEMO MODU" yazar.
3. Jüri QR kodla siteye girip numarasını kaydeder.
4. **SMS gönder** → riskli köylerdeki kayıtlılara mesaj gider.
5. Bitince **Demo modunu kapat** (2 saat sonra kendiliğinden de kapanır).

## Dosyalar

| Dosya | Ne işe yarar | Kim düzenler |
|---|---|---|
| `public/index.html` | Ana sayfa | İremnaz / Yusuf |
| `public/admin.html` | Demo paneli | – |
| `public/kvkk.html` | Aydınlatma metni (köşeli parantezleri doldurun) | Yusuf |
| `netlify/lib/kivilcim.mjs` | Köyler, koordinatlar, **risk eşikleri**, hava verisi, SMS | Selen / Emirhan |
| `netlify/lib/mesajlar.mjs` | **SMS metinleri** | Yusuf |
| `netlify/lib/alerts.mjs` | Kime hangi mesajın gideceği | – |
| `netlify/functions/risk.mjs` | `/api/risk` – sitenin gösterdiği veri | – |
| `netlify/functions/signup.mjs` | `/api/signup` – SMS kaydı | – |
| `netlify/functions/unsubscribe.mjs` | `/api/unsubscribe` – kayıttan çıkma | – |
| `netlify/functions/admin.mjs` | `/api/admin` – demo paneli işlemleri | – |
| `netlify/functions/hourly-check.mjs` | Her saat başı otomatik kontrol, 07:00–20:00 arası riskli köylere SMS | – |

GitHub'da bir dosyayı düzenleyip kaydettiğinizde Netlify siteyi birkaç dakika içinde kendiliğinden günceller.

## Risk kuralları (proje önerisindeki gibi)
- **Kırmızı:** nem < %20 ve rüzgâr > 30 km/s
- **Sarı:** sıcaklık > 30 °C, nem < %30 ve rüzgâr > 30 km/s (OGM 30-30-30)
- **Yeşil:** diğer tüm durumlar

Hava verisi: Open-Meteo (ücretsiz, anahtar gerekmez). Kayıtlar Netlify Blobs'ta saklanır; yalnızca telefon,
köy ve onay zamanı tutulur.
