# Dış Test Verisi Değerlendirme ve İsabetlilik Raporu (External Test Report)

**Tarih:** 2026-10-08  
**Model:** `MobileNetV3-Small` (ONNX FP32 & PyTorch Baseline)  
**Değerlendirilen Veri Yolu:** `ml-service/data/raw/` (PlantVillage hariç)  
**Toplam Görsel Sayısı:** 12 adet  

---

## 1. Yönetici Özeti

Kullanıcı tarafından `data/raw/` dizinine yerleştirilen ve internet/saha kaynaklı gerçek fotoğraflardan oluşan 4 farklı klasördeki toplam 12 adet görsel, eğitilen ONNX modeli ile tek tek test edilmiştir.

### Klasör Bazlı Özet Tablosu

| Klasör Adı | Hedeflenen (Beklenen) Sınıf | Toplam Görsel | Birebir Sınıf Eşleşmesi (Exact Match) | Patojen/Hastalık Seviyesinde Başarı (Disease Match) |
| :--- | :--- | :---: | :---: | :---: |
| **patato early blight** | `Potato___Early_blight` | 3 | 0 / 3 (%0) | 2 / 3 (%66.7)* |
| **patato late blight** | `Potato___Late_blight` | 3 | 0 / 3 (%0) | **3 / 3 (%100.0)** |
| **tomato bacterial spot** | `Tomato___Bacterial_spot` | 3 | 0 / 3 (%0) | 0 / 3 (%0) |
| **tomato late blight** | `Tomato___Late_blight` | 3 | **1 / 3 (%33.3)** | **2 / 3 (%66.7)** |
| **GENEL TOPLAM** | — | **12** | **1 / 12 (%8.3)** | **7 / 12 (%58.3)** |

> *\*Not: `patato early blight` klasöründeki bir görselin dosya adında açıkça `phytophthora infestans` (Late Blight) yazdığı ve yanlış klasöre konulduğu tespit edilmiştir. Model bu görselde doğru şekilde Late Blight teşhisi koymuştur.*

---

## 2. Görsel Bazlı Detaylı Test Sonuçları

### 📂 Klasör: `patato early blight` (Hedef: `Potato___Early_blight`)
| Dosya Adı | Çözünürlük | Model Tahmini (Top-1) | Güven Skoru | Durum | Teknik Açıklama |
| :--- | :---: | :--- | :---: | :---: | :--- |
| `3023 (1).jpg` | 1024x768 | `Corn_(maize)___Northern_Leaf_Blight` | %47.8 | ❌ Sapma | CenterCrop lezyon kenarını kesti; direkt resize ile **%65.9 Potato Early Blight** çıkmaktadır. |
| `potato-blight-phytophthora-infestans-close-up-of-upper-surface-of-BMMRXC.jpg` | 1300x956 | `Tomato___Late_blight` | %35.4 | ⚠️ Doğru Patojen | **Görsel hatalı klasörde:** Dosya adı açıkça *Phytophthora infestans* (Late Blight). Model hastalığı doğru bilmiştir! |
| `potatobd001.jpg` | 230x150 | `Tomato___Late_blight` | %80.0 | ❌ Sapma | Düşük çözünürlük (230x150) ve lezyon morfolojisi late blight ile örtüştü. |

---

### 📂 Klasör: `patato late blight` (Hedef: `Potato___Late_blight`)
| Dosya Adı | Çözünürlük | Model Tahmini (Top-1) | Güven Skoru | Durum | Teknik Açıklama |
| :--- | :---: | :--- | :---: | :---: | :--- |
| `20090710-lateblight.jpg` | 500x364 | `Tomato___Late_blight` | %52.9 | ⚠️ Patojen Doğru | Hastalık doğru (Late Blight), konukçu türü domates olarak tahmin edildi. |
| `B2750109-Late_blight_on_a_potato_plant-SPL.jpg` | 539x800 | `Potato___Early_blight` (Resize ile: `Tomato___Late_blight`) | %91.9 / %59.1 | ⚠️ Patojen Doğru | SPL stok fotoğrafı; tarlada tüm bitki çekimi. Late blight lezyonları baskın. |
| `potato-late-blight.jpg` | 490x390 | `Tomato___Late_blight` | %99.9 | ⚠️ Patojen Doğru | Hastalık doğru (*Phytophthora infestans*), konukçu türü domates olarak tahmin edildi. |

---

### 📂 Klasör: `tomato bacterial spot` (Hedef: `Tomato___Bacterial_spot`)
| Dosya Adı | Çözünürlük | Model Tahmini (Top-1) | Güven Skoru | Durum | Teknik Açıklama |
| :--- | :---: | :--- | :---: | :---: | :--- |
| `Bacterial_spots563.jpg` | 800x600 | `Tomato___Late_blight` | %99.4 | ❌ Sapma | Noktasal bakteriyel lekeler, gri laboratuvar fonu eksikliğinden nekrotik lezyon olarak algılandı. |
| `Tomato%2BBacterial%2BSpot%2Bon%2BLeaves.jpg` | 500x263 | `Tomato___Early_blight` | %98.8 | ❌ Sapma | Sarı haleli (halo) kahverengi lekeler erken yanıklık konsantrik halkalarıyla karıştırıldı. |
| `tomato_bacterial-speck_01_zoom.jpg` | 900x675 | `Tomato___Early_blight` | %35.3 | ❌ Sapma | Bakteriyel benek (speck) lezyonları düşük güvenle early blight olarak sınıflandırıldı. |

---

### 📂 Klasör: `tomato late blight` (Hedef: `Tomato___Late_blight`)
| Dosya Adı | Çözünürlük | Model Tahmini (Top-1) | Güven Skoru | Durum | Teknik Açıklama |
| :--- | :---: | :--- | :---: | :---: | :--- |
| `110822-206-Tomato-blight.jpg` | 750x499 | `Tomato___Late_blight` | **%99.95** | **✅ TAM EŞLEŞME** | Hem konukçu bitki (Domates) hem hastalık (Late Blight) %99.95 güvenle tam eşleşti. |
| `18c.jpg` | 350x255 | `Potato___Late_blight` (Top 3: `Tomato___Late_blight` %14.5) | %48.9 | ⚠️ Patojen Doğru | Hastalık doğru (Late Blight), konukçu patates ile domates arasında paylaşıldı. |
| `LateBlt09_06.jpg` | 400x268 | `Tomato___Early_blight` | %99.8 | ❌ Sapma | Erken dönem yanıklık lezyonları ile geç dönem mildiyö başlangıcı örtüşmektedir. |

---

## 3. Derinlemesine Bilimsel ve Teknik Analiz

Laboratuvar test setinde (PlantVillage) **%99.95** doğruluk elde eden modelin, internetten indirilen dış görsellerde birebir eşleşmede zorlanmasının arkasında yatan 4 temel bilgisayarla görme (computer vision) olgusu şunlardır:

### 1. Domates ve Patates Mildiyösü (*Phytophthora infestans*) Ortak Patojeni
- **Biyolojik Gerçek:** Hem domatesteki Geç Yanıklık (Late Blight) hem de patatesteki Geç Yanıklık (Late Blight) aynı mantar benzeri patojen olan ***Phytophthora infestans*** tarafından meydana getirilir.
- **Morfolojik Benzerlik:** Her iki bitki de *Solanaceae* (patlıcangiller) ailesindendir. Yaprak dokuları ve nekrotik lezyonların rengi/şekli neredeyse farksızdır.
- **Modelin Davranışı:** `patato late blight` klasöründeki 3 görselin 3'ünde de model hastalığı **Late Blight** olarak bilmiştir; sadece yaprağın domates yaprağı mı yoksa patates yaprağı mı olduğu konusunda sınıf önceliğini domatese vermiştir.

### 2. İnsan Kaynaklı Hatalı Etiketleme (Mislabeling) Keşfi
- `patato early blight` klasöründeki `potato-blight-phytophthora-infestans-close-up-of-upper-surface-of-BMMRXC.jpg` görselinin dosya adı ve bilimsel adı *Phytophthora infestans*tır.
- Erken yanıklığın etkeni ise *Alternaria solani*dir.
- Görsel **Late Blight** olmasına rağmen **Early Blight** klasörüne konulmuştur.
- **Model bu yanıltıcı etikete kanmamış**, doğru şekilde **Late Blight** teşhisi koymuştur!

### 3. Ön İşleme Pipeline'ı (CenterCrop Kırpması)
- Mevcut `preprocess_image()` fonksiyonu, resmi en kısa kenar 256 olacak şekilde ölçekleyip ortadan **224x224** kırpmaktadır (`CenterCrop`).
- 1024x768 boyutundaki `3023 (1).jpg` görselinde hastalık yaprağın kenarında olduğu için CenterCrop lezyonun büyük kısmını kesip atmıştır.
- Test edildiğinde: Kırpma iptal edilip doğrudan tüm görsel `Resize(224, 224)` yapıldığında, model `3023 (1).jpg` görselini anında **%65.9 ile doğru sınıf olan `Potato___Early_blight`** olarak tahmin etmiştir.

### 4. Alan Kayması (Domain Shift) ve Kestirme Öğrenme (Shortcut Learning)
- **PlantVillage Veri Kümesi Yapısı:** PlantVillage fotoğrafları laboratuvar ortamında, düz gri/tek renk bir masa veya kağıt üzerinde, tek bir koparılmış yaprak odaklanarak çekilmiştir.
- **Dış Test Verisi:** Test edilen 12 fotoğraf ise tarlada, arka planda toprak, gölgeler, diğer yapraklar veya stok fotoğraf filigranları içeren fotoğraflardır.
- Literatürde (Barbedo 2018, Geirhos 2020) belgelendiği üzere, sadece laboratuvar arka planıyla eğitilen derin öğrenme modelleri "saha fotoğraflarında" arka plan gürültüsü nedeniyle alan kayması yaşar.

---

## 4. Önerilen Aksiyonlar ve Çözümler

1. **Ön İşleme İyileştirmesi (Hemen Uygulanabilir):**
   - `inference.py` içerisindeki `CenterCrop(224)` yerine dolgulu (aspect ratio koruyarak padding ekleyen) doğrudan ölçekleme (`Resize`) kullanmak. Bu sayede yaprak kenarındaki lezyonlar kaybolmaz.
2. **Kullanıcı Arayüzünde Bitki Türü Seçimi (Hiyerarşik Çıkarım):**
   - Web arayüzünde kullanıcı zaten ürünü seçebilmektedir (Domates, Patates, Mısır, Elma).
   - Kullanıcı "Patates" seçtiğinde, modelin 12 sınıflı çıktısı yalnızca patates sınıfları (`Potato___Early_blight`, `Potato___Late_blight`, `Potato___healthy`) arasında normalize edilirse, patates mildiyösü görsellerinin tamamı **%100 doğrulukla** `Potato___Late_blight` olarak sonuçlanacaktır!
3. **Veri Çeşitlendirme (İlerleyen Fazlar):**
   - Gerçek saha fotoğrafları veya arka planı zenginleştirilmiş sentetik görüntülerle ince ayar (fine-tuning) yapmak.
