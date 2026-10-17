# Sekiz Bitkili 3B Model Galerisi Tasarım Spesifikasyonu

Tarih: 17 Ekim 2026. Durum: incelemeye hazır tasarım; uygulama yapılmadı.

## Amaç ve kesinleşen kapsam

Web sitesindeki `/plants` sayfası sekiz bitkiyi listeler. Her bağlantı aynı site içinde `/plants/:cropId` adresindeki etkileşimli modeli açar. İlk teslimde kullanıcı modeli döndürür ve yakınlaştırır; sonraki teslimde anatomik bölgeleri seçip eğitsel bilgi görür. Bu aşamalama ve aşağıdaki sekizli liste kullanıcı tarafından doğrulandı. URL adları, teknik mimari ve bütçeler bu tasarımın önerileridir.

| Türkçe ad | URL kimliği | Bilimsel ad |
| --- | --- | --- |
| Domates | tomato | Solanum lycopersicum |
| Patates | potato | Solanum tuberosum |
| Buğday | wheat | Triticum aestivum |
| Mısır | corn | Zea mays |
| Biber | pepper | Capsicum annuum |
| Elma | apple | Malus domestica |
| Üzüm | grape | Vitis vinifera |
| Şeftali | peach | Prunus persica |

Buğday için ekmeklik buğday, biber için Capsicum annuum temsili önerilir; model alımında tür doğrulanır. Her tür için tek bir sabit gelişim evresindeki örnek gösterilir. Meyve ağacı modelleri tüm ağaç veya açıkça etiketlenmiş genç fidan olabilir; tek başına meyve modeli bitki modeli yerine kabul edilmez.

## Mevcut proje analizi

İncelenen ana belgeler `PROJECT_DETAILS/PROJECT_DETAILS.md` ve `PROJECT_DETAILS/Phase Plans/Phase 4.md` dosyalarıdır; depoda klasörün gerçek adı `Phase Plans`.

| Mevcut durum | Tasarıma etkisi |
| --- | --- |
| Phase 4; GLB, React Three Fiber, kamera, hotspot, patoloji paneli ve ilerleme bağlantısı tanımlıyor. Örnek türler 3–4 bitkiyle sınırlı. | Yeni kapsam sekiz türe genişler; temel görüntüleme ile eğitim ayrı teslim edilir. |
| `frontend/package.json`: React 19, TypeScript, Vite, Tailwind 4, React Router 7. Three.js/R3F/Drei yok. | Mevcut frontend genişletilir; yeni web uygulaması kurulmaz. |
| `frontend/src/App.tsx`: `/`, `/disease-progression`, `/disease-progression-experimental`; diğer URL'ler ana sayfaya gidiyor. | Katalog ve detay rotaları açıkça eklenmeli, bilinmeyen bitki ana sayfaya sessiz yönlendirilmemeli. |
| `frontend/src/types/progression.ts`, ana ilerleme sayfası ve `public/progression/manifest.json` dört tür destekliyor. | 3B katalog mevcut `CropId` tipine bağlanmaz. |
| Deneysel `SupportedCropId` sekiz tür içeriyor: tomato, potato, corn, apple, grape, pepper, peach, squash. | Yeni sekizli listede squash yerine wheat bulunur; deneysel liste değiştirilmez. |
| Her iki ilerleme sayfası başlangıçta yerel state ile tomato seçiyor; URL parametresi tüketmiyor. | İleriki hastalık bağlantısında yalnız URL üretmek yetmez; hedef sayfaya parametre desteği gerekir. |
| SQL başlangıç betiğinde `crop_anatomy_models`, `plant_anatomy_pins`, `anatomy_pin_pathologies` mevcut. .NET API ise başlangıç düzeyinde. | Tablo tanımı çalışan API kanıtı değildir. İlk sürüm statik veriyle backend bağımsız olabilir. |

Ana plandaki 3–5 MB ile Phase 4'teki 3.5 MB sınırı birleştirilerek model başına en fazla 3.500.000 byte önerilir. Phase 4'ün 30–50 bin üçgen hedefi ile `<45.000` kabul koşulunda daha sıkı koşul esas alınır. Saydam yaprak yüzeylerinde sıfır non-manifold geometri ve tek materyal zorunluluğu görsel doğruluğu gereksiz bozabilir; bunların yerine hatalı geometri içermeyen, doğrulanan görünüm ve aşağıdaki performans bütçesi önerilir. Bunlar mevcut Phase 4 metnini kendiliğinden değiştirmez.

## Referans ve mimari kararı

Kullanıcının [Sketchfab domates referansı](https://sketchfab.com/3d-models/tomato-plant-e0b559690e384fc0a9f3a05913f609c4) 17 Ekim incelemesinde 403 verdi. Görünümü, yazar adı, lisansı, indirilebilirliği ve poligon sayısı doğrulanamadı. Bu URL görsel hedefin referansıdır; onaylanmış üretim varlığı değildir.

| Seçenek | Değerlendirme |
| --- | --- |
| Sketchfab gömme | Hazır barındırılan görüntüleyici yaklaşımı; kullanılabilirlik, lisans ve entegrasyon ayrıca doğrulanmalı. Platform bağımlılığı nedeniyle temel seçim değil. |
| `<model-viewer>` | Basit model sunumu için daha küçük entegrasyon işi; eğitim özellikleri de mümkün. Ancak mevcut Phase 4 R3F yönünü değiştirir. |
| Three.js + React Three Fiber + Drei | Kamera ve ilerideki parça etkileşimleri için mevcut Phase 4 ile uyumlu; önerilen seçim. |

React 19 için R3F 9 uyumluluğu [resmî kurulum belgesinde](https://r3f.docs.pmnd.rs/getting-started/installation) belirtilir. Uygulamada `three`, `@react-three/fiber@9`, uyumlu `@react-three/drei` ve `@types/three` sürümleri peer dependency kontrolü sonrası lockfile'a sabitlenir; alpha sürüm kullanılmaz. [Drei useGLTF](https://drei.docs.pmnd.rs/loaders/gltf-use-gltf), GLB yükleme ve özel Draco decoder yolu sağlar. [Drei Html](https://drei.docs.pmnd.rs/misc/html), sonraki aşamada 3B konuma bağlı etiket ve örtülme davranışını destekler. Alternatif: [model-viewer](https://modelviewer.dev/).

## Aşama A — Katalog ve temel görüntüleyici

### Kullanıcı akışı

1. Masaüstü ve mobil menüde `3D Plants` bağlantısı `/plants` sayfasına gider. Mevcut İngilizce arayüz dili korunur; Türkçe çeviri bu işin kapsamı değildir.
2. Sayfa sekiz semantik bağlantıdan oluşan kart listesi gösterir. Her kartta bitki adı, bilimsel ad ve statik poster vardır. Kartlarda canlı canvas bulunmaz.
3. Bağlantı örneğin `/plants/tomato` sayfasını aynı sekmede açar. Doğrudan açma, yenileme, geri/ileri gezinme çalışır.
4. Önce poster ve yükleniyor bilgisi, ardından seçili tek bitkinin modeli gösterilir. Fare sürükleme/tek parmak döndürür; tekerlek/iki parmak yakınlaştırır. Pan ve otomatik dönme ilk sürümde kapalıdır.
5. `Reset view`, yakınlaştır/uzaklaştır ve yön düğmeleri klavyeyle kullanılabilir. `Back to plants` ve model kaynak/lisans bağlantıları görünürdür. Reset kamera konumunu ve hedefini başlangıca getirir.

Kamera modelin bounding box ölçülerine göre kadrajlanır; model ölçeğini her ekran boyutunda değiştirmek yerine kamera uzaklığı ayarlanır. FOV 45°, polar açı 10°–85°, minimum/maximum mesafe model yarıçapına göre belirlenir ve bitkinin içine girilmesini önler. Dar ekranda yatay FOV da hesaba katılır. Normalizasyon kök tabanı merkezini (0,0,0), Y eksenini yukarı, birimi metre yapar. Pan olmadığı için reset yalnız orbit/zoom durumunu temizler.

### Durumlar ve erişilebilirlik

- Katalog yükleme hatası: açıklama ve yeniden dene; boş liste başarı sayılmaz. Bilinen ancak hazır olmayan model: poster, `Model unavailable` ve kataloğa dönüş; bozuk GLB bağlantısı yayımlanmaz.
- Bilinmeyen `/plants/:cropId`: bitki bulunamadı ekranı ve katalog bağlantısı. Sekiz tür dışındaki kimlikler seçili bitki gibi gösterilmez.
- GLB 404, bozuk GLB, decoder hatası veya 20 saniyelik yükleme süresi: poster, açık hata, yeniden dene. Gerçek byte ilerlemesi yoksa sahte yüzde verilmez.
- WebGL2/context oluşturma başarısızlığı veya context kaybı: okunabilir poster durumu; sayfa gezinmesi ve kaynak bilgisi çalışmaya devam eder.
- Model değiştirme/ayrılma sonrasında eski yüklemenin sonucu yeni sayfaya uygulanmaz. Retry başarısız loader cache'ini temizler; aynı hata sonsuza kadar cache'lenmez.
- Canvas dışında sayfa kaydırılabilir. Dokunma hareketleri yalnız görüntüleyici alanında yakalanır. Düğmeler en az 44×44 CSS px, odak görünür, canvas açıklamalı ve yükleme durumu `aria-live=polite` olur.
- Otomatik hareket yoktur. Sonraki aşamanın kamera animasyonları `prefers-reduced-motion` ile anında uygulanır.

### Varlık teslim koşulları

Her bitki için sürümlü `plant.glb`, `poster.webp` ve kaynak kaydı gerekir. Çıktı yolu `/models/plants/<cropId>/v1/plant.glb`; poster aynı klasördedir. Başlangıç çözümü aynı origin'den statik sunumdur. Modelin kendisi optimize edilir; webde görüntülenebilmesi indirip tekrar yayımlama izni kabul edilmez. Varlık tesliminde yazar, kaynak URL, lisans adı/URL, atıf metni, değişiklik özeti ve doğrulama tarihi kaydedilir. İzinleri netleşmeyen model `ready` olamaz. Model indirme/satın alma ve üretim bu planlama işinde yapılmadı.

- GLB en fazla 3.500.000 byte; model başına `<45.000` üçgen; poster en fazla 200.000 byte.
- Dokular için başlangıç hedefi 1024×1024, en fazla 2048×2048; yaprak alpha görünümü korunur. PNG/JPEG tabanlı dokular başlangıç seçimi; KTX2 ancak ölçüm gerektirirse ve decoder desteğiyle eklenir.
- Draco önerilir; decoder dosyaları `/decoders/draco/` altında aynı origin'den sürümüyle sunulur. Model bütçeyi sıkıştırmasız sağlıyorsa `compression: none` geçerlidir.
- Katalogda GLB ve 3B runtime indirilmez. Detayda yalnız seçili GLB ve gerekiyorsa decoder indirilir; sekiz modeli önceden yükleme yoktur.
- Aynı anda bir canvas; DPR 1–1.5, boşta demand render, ilk sürümde pahalı postprocessing ve dinamik gölgeler yoktur. Kaynak yaşam döngüsü eski modelin GPU kaynaklarını bırakır; dispose edilmiş nesne cache'ten tekrar kullanılmaz.
- Hedef: seçilen gerçek orta sınıf Android cihazda 30 FPS, entegre GPU masaüstünde 60 FPS; 30 saniyelik orbit örneğinde frame süreleri raporlanır. Ağ hedefi: boş cache, 10 Mbps/100 ms RTT, detay açılışından ilk etkileşilebilir kareye ≤5 saniye. Ölçüm cihazı/tarayıcı rapora yazılmadan bu hedefler sağlandı sayılmaz. Orijinal `<300 ms` Draco hedefi ölçülür, tüm mobil cihazlar için garanti verilmez.

Model içindeki gelecekte seçilebilir yapılar için kararlı isimler korunur: `mesh_canopy`, `mesh_stem`, varsa `mesh_roots`, `mesh_fruit`. Hazır model ayrı parçalar içermiyorsa A aşamasını engellemez; B öncesi editör düzenlemesi veya doğrulanmış anchor tanımı gerekir. Görünmeyen kök/yumru mevcutmuş gibi gösterilmez. Kesit ve toprak altı geometri üretimi ayrı varlık işidir.

## Veri ve modül sınırları

Yeni `PlantModelId`, yalnız yukarıdaki sekiz slug'ın union tipidir. Mevcut tanı/ilerleme tipleri genişletilmez. Bir bitkinin 3B modelinin olması AI tanısı, hastalık animasyonu veya tarımsal öneri desteği anlamına gelmez.

`frontend/public/models/plants/manifest.json`, `schemaVersion: 1` ve `plants: PlantModelEntry[]` içerir. Tam sürümde tam sekiz benzersiz kayıt ve sekiz `ready` model zorunludur. Geliştirmede `unavailable` kullanılabilir, sekiz modelin teslimi yerine geçmez.

| Alan | Sözleşme |
| --- | --- |
| `id`, `name`, `scientificName` | PlantModelId, İngilizce görünen ad, bilimsel ad |
| `status`, `posterUrl` | `ready` veya `unavailable`; aynı origin mutlak poster yolu |
| `model` | unavailable için null; ready için `{url, version, byteSize, triangleCount, compression}`; compression `draco` veya `none` |
| `source` | unavailable için null olabilir; ready için `{url, author, licenseName, licenseUrl, attribution, modifications, verifiedAt}` |
| `anatomyUrl` | A aşamasında null; B aşamasında sürümlü JSON yolu |

Runtime doğrulama bilinmeyen kimlik, tekrar, eksik ready varlık bilgisi, NaN/negatif bütçe veya same-origin dışı varlık yolu için kontrollü hata verir. Kaynak/lisans URL'leri harici HTTPS olabilir. Public manifestte gizli anahtar ve üçüncü taraf erişim tokenı yoktur.

`getPlantCatalog(signal?: AbortSignal): Promise<PlantModelEntry[]>` tek veri erişim sınırıdır. Hook yükleme/hata/iptal yaşam döngüsünü yönetir. Görüntüleyici `PlantModelEntry` tüketir; listeden veya .NET'ten haberi olmaz. Manifest küçük olduğu için global kalıcı cache gerekmiyor; HTTP cache yeterli. Model URL'si sürümlenir, manifest yeniden doğrulanır. Statik varlık sunumu offline/PWA desteği iddiası oluşturmaz.

## Aşama B — Anatomik keşif

A tesliminden ayrı kabul edilir. Her modelde en az yaprak ve gövde, geometri izin verirse kök boğazı/meyve/başak/koçan işaretlenir. Aynı dört organ tüm türlere zorla uygulanmaz. Seçim hem pin hem metin listesinden yapılabilir; kamera geçişi en fazla 800 ms ve kullanıcı hareketiyle kesilebilir. Örtülen pin canvas'ta gizlenir, metin listesinde erişilebilir kalır.

Model sürümüne bağlı ayrı anatomi belgesi: `{schemaVersion: 1, cropId, modelVersion, pins: AnatomyPin[]}`. Pin: `{id, label, region, position: [x,y,z], description, pathologies: Pathology[]}`. Konumlar optimize edilmiş GLB'nin kök-local metre koordinatlarıdır; görüntüleyici pinleri modelle aynı dönüşüm altında taşır. Üçgen/vertex indeksine bağlanılmaz: optimizasyon indeksleri değiştirebilir. Model sürümü uyuşmazsa pinler yüklenmez ve bilgilendirme gösterilir.

Pathology: `{id, title, pathogen, externalSymptom, internalSymptom, references: string[], image: {url, alt, attribution} | null, progression: {route: '/disease-progression' | '/disease-progression-experimental', cropId: string, diseaseKey: string} | null}`. Metinler tarımsal içerik sorumlusu tarafından doğrulanır. Model sağlıklı temsildir; pindeki açıklama o modelde hastalık tespit edildiği anlamına gelmez. Histoloji görseli bulunmuyorsa boş sekme veya uydurma görsel gösterilmez.

Seçimde yan bilgi paneli açılır; mobilde erişilebilir dialog, Escape ile kapanma ve tetikleyiciye odak iadesi sağlanır. Görsel modelin içini gerçekten kesme, hastalığı 3B dokuya boyama, rüzgâr animasyonu ve AR ilk iki aşamanın kapsamında değildir.

İlerleme bağlantısı ancak bitki VE hastalık hedef ekranda eşleşiyorsa gösterilir. Mevcut dört türün ana sayfası ve diğer türlerin deneysel sayfası ayrı izinli eşleme tablosuyla çözülür; buğday için bağlantı yoktur. Desteklenmeyen Fusarium gibi bir hastalık, sırf domates destekleniyor diye Early Blight ekranına gönderilmez. B aşamasında hedef sayfalara `?crop=<id>&disease=<key>` okuma/validasyon eklenir; geçersiz eşleşmede açık mesaj gösterilir, sessizce domatese geçilmez. Disease key eşlemesi mevcut manifestteki gerçek hastalık adlarından içerik kaydına sabitlenir.

## Aşama C — İsteğe bağlı backend entegrasyonu

İlk iki teslim statik manifest ve anatomi JSON'larıyla çalışabilir. Yönetim paneli, merkezî içerik güncelleme veya veritabanı gereksinimi doğarsa mevcut SQL tabloları kullanılır. Yeni paralel tablo ailesi kurulmaz. Gelecekte `GET /api/v1/crops/models` ve `GET /api/v1/crops/{cropId}/anatomy-markers` sözleşmeleri statik DTO biçimlerini döndürür. URL slug'ı ile DB UUID eşlemesi sunucuda yapılır.

Geçiş öncesi mevcut şemaya model sürümü, poster, lisans/kaynak ve slug alanlarının hangi migration ile ekleneceği tasarlanmalıdır. Dokümandaki “normalized coordinates” ifadesi, bu tasarımın metre cinsinden model-local koordinat kararıyla uzlaştırılmalıdır. Bu aşama için henüz çalışan API veya tamamlanmış migration yoktur; A/B'nin kabul koşulu değildir.

## Phase 4 görevleriyle eşleme

| Eski görev | Yeni teslim |
| --- | --- |
| TODO-401 model temini | Sekizli katalog, kaynak/lisans kaydı, doğrulanmış GLB ve poster |
| TODO-402 optimizasyon | Byte/üçgen bütçeleri, çapraz platform araç, decoder ve ölçüm raporu |
| TODO-403 sahne/kamera | A aşaması; lazy runtime, orbit/zoom/reset, hata ve mobil davranış |
| TODO-404 hotspot | B aşaması; sürümlü anchor, örtülme, seçim ve kamera |
| TODO-405 bilgi verisi/API | B'de statik bilgi; C'de ihtiyaç halinde API |
| TODO-406 panel/ilerleme | B aşaması; erişilebilir panel ve hastalıkla doğrulanan bağlantı |

## Kabul ve teslim sınırı

A: sekiz gerçek, izinleri doğrulanmış model; sekiz doğrudan çalışan URL; masaüstü/mobil kontroller; GLB hatası ve WebGL yetersizliğinde kullanılabilir poster; liste üzerinde sıfır GLB isteği; bütçe ve performans ölçümü. Yayın sunucusu `/plants/*` için SPA fallback sağlamalı, olmayan `/models/*` dosyasına HTML/200 yerine 404 vermelidir.

B: tüm bitkilerde doğrulanmış en az iki pin; sürüm uyuşmazlığı koruması; bilgi paneli, odak/klavye davranışı; yalnız desteklenen hastalık bağlantıları. C ayrı iş olarak değerlendirilir.

En büyük belirsizlik model varlıklarının temini ve anatomik kalitesidir. İlk teknik doğrulama bir domates modeliyle yapılır, ardından sekize genişletilir. Sekiz model bulunmadan “özellik tamamlandı” denmez. Yalnız katalog ve viewer kodunun bitmesi yeterli değildir.
