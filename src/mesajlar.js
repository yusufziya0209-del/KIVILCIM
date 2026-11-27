// Kıvılcım – SMS metinleri. (Yusuf: mesajları burada düzenleyeceğiz.)
//
// Notlar:
// - Türkçe karakterler (ç, ğ, ı, ö, ş, ü) SMS'i daha erken böler (yaklaşık 150 yerine 70 karakter),
//   bu yüzden şimdilik metinler İngilizce harflere çevrilerek gönderiliyor (toAscii).
// - Tek SMS'e sığması için metin 160 karakteri geçmemeli. Admin panelindeki önizleme uzunluğu gösterir.

export function alertMessage(loc) {
  const yer = loc.name.replace(" merkez", "");
  const zaman = loc.window ? `${loc.window.from}-${loc.window.to} arasi ` : "";
  if (loc.peak === "red") {
    return toAscii(
      `KIVILCIM: ${yer} bugun ${zaman}yangin riski KIRMIZI. Hava cok kuru ve ruzgarli, kivilcim hizla yayilir. Aniz ve bahce atigi yakmayin.`
    );
  }
  if (loc.peak === "yellow") {
    return toAscii(
      `KIVILCIM: ${yer} bugun ${zaman}yangin riski SARI. Hava sicak, kuru ve ruzgarli. Yakma yapacaksaniz serin ve sakin bir gunu bekleyin.`
    );
  }
  return null; // Yeşil günde mesaj gönderilmez
}

export function toAscii(s) {
  const map = { ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I", ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U", â: "a", Â: "A" };
  return s.replace(/[çÇğĞıİöÖşŞüÜâÂ]/g, (c) => map[c]);
}
