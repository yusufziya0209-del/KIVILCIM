// Kıvılcım – SMS ve site metinleri.
//
// Mesajlar Genişletilmiş Paralel Süreç Modeli'ne (EPPM; Witte, 1992) göre yazıldı:
// bir uyarı ancak hem TEHDİDİ (bugün, burada, somut sebep) hem de YAPILACAK TEK BASİT EYLEMİ
// birlikte verirse davranışa dönüşür. Sadece tehdit verilirse insanlar korkup mesajı görmezden gelir;
// sadece yasak söylenirse "bana bir şey olmaz" iyimserlik yanlılığı (Weinstein, 1980) devreye girer.
//
// Her mesajın yapısı:
//   1) Kim gönderiyor:            KIVILCIM
//   2) Yer + zaman + seviye:      "Seydikemer'de bugün 12-18 arası yangın riski KIRMIZI."
//   3) Somut sebep-sonuç:         "Hava çok kuru ve rüzgârlı, kıvılcım hızla yayılır."
//   4) Tek, kolay eylem:          "Anız ve bahçe atığı yakmayı yarına bırakın."
//
// Teknik notlar:
// - Türkçe karakterler SMS'i 70 karakterde böler; bu yüzden SMS'ler İngilizce harflerle gider (toAscii).
// - Tek SMS'e sığması için 160 karakteri geçmemeli. Demo panelindeki önizleme uzunluğu gösterir.

export function alertMessage(loc) {
  const yer = loc.yerde || loc.name;
  // "12:00-18:00" yerine "12-18 arasi" (yer kazanmak için)
  const saat = (t) => String(Number(t.slice(0, 2)));
  const zaman = loc.window ? `${saat(loc.window.from)}-${saat(loc.window.to)} arasi ` : "";
  if (loc.peak === "red") {
    return toAscii(
      `KIVILCIM: ${yer} bugun ${zaman}yangin riski KIRMIZI. Hava cok kuru ve ruzgarli, kivilcim hizla yayilir. Aniz ve bahce atigi yakmayi yarina birakin.`
    );
  }
  if (loc.peak === "yellow") {
    return toAscii(
      `KIVILCIM: ${yer} bugun ${zaman}yangin riski SARI. Sicak ve kuru havada ates kolay kontrolden cikar. Yakacaksaniz serin, sakin bir sabahi bekleyin.`
    );
  }
  return null; // Yeşil günde mesaj gönderilmez (uyarı yorgunluğunu önlemek için)
}

export function toAscii(s) {
  const map = { ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I", ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U", â: "a", Â: "A" };
  return s.replace(/[çÇğĞıİöÖşŞüÜâÂ]/g, (c) => map[c]);
}
