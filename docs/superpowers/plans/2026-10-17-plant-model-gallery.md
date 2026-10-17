# Plant Model Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sekiz bitkilik bağlantı listesinden açılan döndürme/yakınlaştırma destekli 3B görüntüleyici kurmak; anatomik eğitimi ayrı aşamada eklemek.

**Architecture:** Mevcut React Router uygulamasında `/plants` ve `/plants/:cropId`. Statik manifest veri katmanı, lazy R3F viewer ve aynı origin'den sürümlü GLB varlıkları; B aşamasında ayrı anatomi verisi ve panel.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind 4, React Router 7, Three.js, React Three Fiber 9, uyumlu Drei; test için Vitest/Testing Library ve Playwright.

**Spec:** [Sekiz Bitkili 3B Model Galerisi](../specs/2026-10-17-plant-model-gallery-design.md)

Durum: Uygulama için incelenecek plan. Bu belgede işaretli tamamlanmış uygulama görevi yoktur. A ilk sürüm, B sonraki sürümdür; C backend kapsamı burada uygulanmaz.

## Global Constraints

- Türler tam olarak `tomato`, `potato`, `wheat`, `corn`, `pepper`, `apple`, `grape`, `peach`; mevcut ML/progression tipleri genişletilmez.
- GLB en fazla 3.500.000 byte; model başına `<45.000` üçgen; poster en fazla 200.000 byte.
- Katalogda GLB ve 3B runtime indirilmez. Detayda yalnız seçili GLB ve gerekiyorsa decoder indirilir; sekiz modeli önceden yükleme yoktur.
- Aynı anda bir canvas; DPR 1–1.5; FOV 45°; polar açı 10°–85°; ilk sürümde pan ve auto-rotate yoktur.
- Varlıklar aynı origin'den; decoder `/decoders/draco/`; model `/models/plants/<cropId>/v1/plant.glb`.
- Arayüz mevcut uygulama gibi İngilizce; kaynak/lisans bilgisi görünür; izinleri doğrulanmayan varlık `ready` olamaz.
- Düğmeler en az 44×44 CSS px; hareket azaltma tercihi ve klavye erişimi korunur.
- İlk sürümde backend, GIS, ML modeli, hastalık dokusu, AR veya kesit geometri işi yoktur.

## Review Focus

- Hızlı route değişimi sırasında önceki modelin yeni bitkiyle görünmesi: Görev 3 lifecycle testi.
- Eksik GLB'ye hosting katmanının HTML/200 döndürmesi: Görev 4 yayın testi.
- Lisanssız veya placeholder varlığın sekizli tamamlanmış katalog sayılması: Görev 2 strict doğrulama.
- WebGL/context kaybı ve tekrar denemenin aynı cache hatasına saplanması: Görev 3 hata senaryoları.
- Buğday veya farklı domates hastalığının yanlış ilerleme ekranına gitmesi: Görev 6 eşleme testleri.

## Dosya ve sorumluluk haritası

Yeni modül: `frontend/src/features/plant-models/`. `types.ts` sözleşme; `catalogService.ts` yükleme/doğrulama; `usePlantCatalog.ts` lifecycle; `PlantCatalogPage.tsx` liste; `PlantModelPage.tsx` detay durumları; `PlantViewer.tsx` lazy WebGL sınırı; `PlantScene.tsx` model/ışık; `camera.ts` kadraj matematiği; `ViewerControls.tsx` erişilebilir kontroller; `ViewerErrorBoundary.tsx` hata/reset.

Yeni veriler: `frontend/public/models/plants/manifest.json`, sekiz `<id>/v1/plant.glb` ve `poster.webp`; `frontend/public/decoders/draco/`. Yeni araçlar: `frontend/scripts/prepare_plant_models.mjs`, `verify_plant_models.mjs`.

Mevcut değişiklikler: `frontend/src/App.tsx`, `frontend/src/components/LandingHero/Navbar.tsx`, `frontend/package.json`, `frontend/package-lock.json`, `frontend/README.md`. B'de ayrıca iki progression sayfası. Başlangıçta mevcut Phase 4 ve kullanıcıya ait raporlar değiştirilmez.

Komutlar aksi belirtilmedikçe `frontend` klasöründen çalıştırılır. Bağımlılık kesin sürümleri uygulamada peer dependency kontrolüyle seçilip lockfile'a kaydedilir. Planlama sırasında paket kurulmadı.

## Görev 1 — Katalog sözleşmesi ve veri erişimi

**Files:** Create `src/features/plant-models/{types.ts,catalogService.ts,usePlantCatalog.ts,catalogService.test.ts}` ve `vitest.config.ts`; Modify `package.json`, `package-lock.json`.

**Interfaces:** `PlantModelId`, `PlantModelEntry` spec alanlarıyla; `parsePlantCatalog(input: unknown): PlantModelEntry[]`; `getPlantCatalog(signal?: AbortSignal): Promise<PlantModelEntry[]>`. Hook `usePlantCatalog(): {plants: PlantModelEntry[]; loading: boolean; error: Error|null; retry: () => void}`.

- [ ] Test altyapısını Vitest, jsdom, Testing Library ile ekle; `test:plants` komutu yalnız modül testlerini `vitest run src/features/plant-models` ile çalıştırsın.
- [ ] `catalogService.test.ts`: sekiz benzersiz ID kabulü; wheat kabulü/squash reddi; eksik/tekrar ID, ready+null model, 3.500.001 byte, 45.000 üçgen, dış-origin model URL reddi; AbortSignal ve HTTP 404 kontrollü hata testleri yaz.
- [ ] `npm run test:plants` çalıştır; henüz olmayan servis nedeniyle testlerin başarısız olduğunu doğrula.
- [ ] Tipleri ve parser'ı uygula; aynı origin varlıkları yalnız `/models/plants/` altına sınırla, path traversal reddet. Hook retry ve unmount iptalini yönetsin. Başarısız istek veri gibi cache'lenmesin.
- [ ] `npm run test:plants` ve `npm run build`: PASS. Görev dosyalarını seçerek commit et: `feat: define plant model catalog contract`.

## Görev 2 — Tek pilot modelden sekiz doğrulanmış varlığa

**Files:** Create `public/models/plants/manifest.json`, `public/models/plants/<id>/v1/{plant.glb,poster.webp}`, `public/decoders/draco/`, `scripts/{prepare_plant_models.mjs,verify_plant_models.mjs}`, `src/features/plant-models/assetValidation.test.ts`; Modify `package.json`; Create `PROJECT_DETAILS/Project Reports/Phase 4 Reports/ASSET_REGISTER.md`.

**Interfaces:** Manifest Görev 1 sözleşmesini üretir. `npm run test:plant-assets` strict sekiz-ready kontrolüdür. `prepare_plant_models.mjs --input <path> --output <path>` kaynak GLB'yi normalize edip Draco GLB üretir; ham kaynak üzerine yazmaz. Dönüşüm araç sürümü rapora kaydedilir.

- [ ] Doğrulayıcı için küçük sentetik fixture testleri yaz: eksik lisans, olmayan dosya, yanlış magic/header, bütçe aşımı, eksik poster ve sekizden az ready kayıt reddedilsin. Test fixture'ı teslim modeli sayılamaz.
- [ ] `npm run test:plants`: yeni testler FAIL; validator ve Node tabanlı dönüştürme betiğini uygula. glTF-Transform araçlarını uyumlu sabit sürümle dev dependency olarak ekle. Byte/üçgen sayılarını son GLB'den hesapla; yalnız manifestteki iddiaya güvenme.
- [ ] Önce lisansı ve indirilebilirliği doğrulanmış bir domates modeli temin et. Kaynak kaydını doldur; metre/Y-up/root-base normalizasyonu ve yaprak alpha kalitesini doğrula; sıkıştırma sonrası poster üret. Referans URL'nin indirilebilir olduğu varsayılmasın.
- [ ] Domatesi Görev 3 viewer'ında doğrula, sonra diğer yedi türü aynı süreçle tamamla. Kaynak yoksa ayrı 3B model üretim işi tanımla; sahte bitki veya tek meyve ile boşluğu doldurma.
- [ ] Tüm sekiz varlık için görsel denetim: doğru tür, tam bitki/fidan, dokular, ters normaller, taban/kadraj, örtüşen alpha yüzeyleri. Lisans/atıf kanıtını ASSET_REGISTER'a yaz; hazır olmayanları `unavailable` tut.
- [ ] `npm run test:plants`, `npm run test:plant-assets`: PASS yalnız sekiz gerçek hazır varlıkla. `git check-ignore` ile çıktının takibini kontrol et; yalnız izin verilen dağıtım dosyalarını commit et: `feat: add licensed optimized plant assets`.

Görev 2'nin pilot kısmı Görev 3'ten önce; kalan yedi model pilot viewer doğrulandıktan sonra tamamlanır.

## Görev 3 — İzole ve dayanıklı görüntüleyici

**Files:** Create modülde `PlantViewer.tsx`, `PlantScene.tsx`, `camera.ts`, `ViewerControls.tsx`, `ViewerErrorBoundary.tsx`, `camera.test.ts`, `PlantViewer.test.tsx`; Modify `package.json`, `package-lock.json`.

**Interfaces:** `PlantViewer({plant}: {plant: PlantModelEntry})`; `fitCamera(bounds: {min: [number,number,number]; max: [number,number,number]}, aspect: number, fov: number): {target: [number,number,number]; distance: number; minDistance: number; maxDistance: number}`. `ViewerControls` reset/zoom/rotate callback'leriyle render katmanından ayrılır.

- [ ] Kamera testleri yaz: küçük bitki, uzun mısır, geniş ağaç, 390px portre aspect, boş bounding box; kadraj tüm sınırları içerir ve tüm değerler finite olur. Lifecycle testleri: 20 saniye timeout, unmount, model A geç çözülürken B'ye geçme, GLB error sonrası retry.
- [ ] `npm run test:plants`: FAIL doğrula. `three`, R3F 9, Drei ve tip bağımlılıklarını kur; `npm ls react three @react-three/fiber @react-three/drei` ile peer hatası olmadığını doğrula.
- [ ] R3F scene, dengeli ışık, demand render, orbit limitleri ve model yarıçapına bağlı kadrajı uygula. Viewer yalnız detay rotasından lazy import edilsin. Draco yolu aynı origin olsun.
- [ ] Kaynak yaşam döngüsünü seçili tek modele sınırla: route değişiminde eski loader sonucu atılır; owned geometry/material/texture bırakılır; loader cache'i boşaltılır. Ağ iptali mümkün olmayan istek sonucunun UI'ye uygulanması yine engellenir.
- [ ] Poster/error boundary, WebGL2 fallback ve retry uygula. Testlerde hata sınırını mock loader ile sınayarak gerçek WebGL başarısı iddiasında bulunma; gerçek render Görev 4'te ölçülür.
- [ ] `npm run test:plants`, `npm run build`, `npm run lint`: PASS veya önceden var olan sorunları ayrı kaydet. Commit: `feat: add interactive plant model viewer`.

## Görev 4 — URL listesi, entegrasyon ve A kabulü

**Files:** Create modülde `PlantCatalogPage.tsx`, `PlantModelPage.tsx`, `PlantRoutes.test.tsx`; Create `e2e/plant-models.spec.ts`, `playwright.config.ts`; Modify `src/App.tsx`, `src/components/LandingHero/Navbar.tsx`, `package.json`, `package-lock.json`, `README.md`; Create `PROJECT_DETAILS/Project Reports/Phase 4 Reports/PHASE_4A_VALIDATION.md`.

**Interfaces:** `/plants` katalog; `/plants/:cropId` detay; sayfalar Görev 1 hook'unu ve Görev 3 viewer'ını tüketir. `test:plants:e2e` komutu `playwright test e2e/plant-models.spec.ts` çalıştırır.

- [ ] Route/component testleri yaz: sekiz doğru href; wheat detay; unknown ID bulunamadı; unavailable model açıklaması; katalog fetch hatası; poster alt metni; menünün mobil ve masaüstü bağlantısı.
- [ ] `npm run test:plants`: FAIL; sayfaları, route'ları ve navbar bağlantılarını uygula. Mevcut catch-all'dan önce plant rotalarını ekle. Liste 3B modülü statik import etmesin.
- [ ] Playwright ile katalogda sıfır GLB isteği ve sıfır viewer chunk isteği, detayda sadece seçili GLB, doğrudan URL/refresh/back-forward, zoom/rotate/reset, 404/bozuk GLB, decoder hatası, context kaybı ve retry senaryolarını yaz. 390×844 mobil viewport'ta yatay taşma ve canvas dışı scroll kontrol et.
- [ ] `npm run test:plants`, `npm run test:plant-assets`, `npm run test:plants:e2e`, `npm run build`, `npm run lint` çalıştır. Mevcut `npm run test:assets` ve `npm run test:crops` regresyonlarını da kontrol et; mevcut hata varsa yeni değişiklikten ayır.
- [ ] Yayın ortamında `/plants/wheat` refresh'inin HTML uygulama girişine gittiğini; olmayan `/models/plants/missing.glb` isteğinin 404 olduğunu doğrula. Hosting sağlayıcısı henüz seçili değilse README'ye sağlayıcıdan bağımsız fallback kuralını yaz; gerçek yayın testi bekleyen kabul maddesi olarak kalsın.
- [ ] Gerçek Android Chrome ve iOS Safari'de dokunma/scroll, masaüstünde klavye ve entegre GPU üzerinde kamera denetimi yap. 10 Mbps/100 ms RTT cold-cache ≤5 saniye ve 30 saniyelik desktop 60/mobile 30 FPS hedeflerini raporla; sekiz modeli sırayla aç-kapat döngüsünde kaynakların birikmediğini incele.
- [ ] PHASE_4A_VALIDATION'a ölçüm ortamını, sonuçları, eksikleri ve sekizli kabul durumunu yaz. Hedefler geçmeden A tamamlandı deme. Commit: `feat: integrate plant gallery routes and validate phase 4a`.

## Görev 5 — B aşaması anatomik veri ve seçim

**Files:** Create modülde `anatomyTypes.ts`, `anatomyService.ts`, `AnatomyHotspots.tsx`, `AnatomyDetailPanel.tsx`, `anatomy.test.tsx`; Modify `PlantViewer.tsx`, `PlantScene.tsx`, `PlantModelPage.tsx`; Create `public/models/plants/<id>/v1/anatomy.json`; Modify manifest.

**Interfaces:** Spec'teki `AnatomyPin`, `Pathology`; `getPlantAnatomy(plant: PlantModelEntry, signal?: AbortSignal): Promise<AnatomyDocument|null>`. ModelVersion uyumsuzluğunda kontrollü hata; anatomyUrl null ise null. Seçili pin state'i detay sayfasında tutulur.

- [ ] Testler yaz: sekiz türde en az iki pin, modelVersion mismatch, olmayan anatomy JSON, finite olmayan koordinat, görselsiz pathology, klavyeden pin seçimi, Escape ve odak iadesi.
- [ ] `npm run test:plants`: FAIL; model-local anchor doğrulamasını ve veri servisini uygula. Bilgiler kaynak referansları ve içerik sorumlusu incelemesiyle teslim edilsin.
- [ ] Drei Html pinleri ve eşdeğer DOM seçim listesini uygula; örtülen pin tab sırasından çıkarılsın, metin listesinden erişilebilsin. Panel mobilde dialog olsun. Kamera geçişi ≤800 ms, reduced-motion'da anlık, orbit etkileşiminde kesilebilir olsun.
- [ ] Her modelin nihai sıkıştırılmış sürümünde anchor konumlarını elle doğrula. Model değişmişse JSON modelVersion artırmadan yayınlama. Kök görünmüyorsa kök pini uydurma.
- [ ] `npm run test:plants`, `npm run test:plants:e2e`, `npm run build`: PASS; e2e'ye örtülme, reduced-motion ve panel seçimi ekle. Commit: `feat: add educational plant anatomy annotations`.

## Görev 6 — B aşaması hastalık ilerleme bağlantıları

**Files:** Create modülde `progressionLinks.ts`, `progressionLinks.test.ts`; Modify `AnatomyDetailPanel.tsx`, `src/pages/DiseaseProgressionPage.tsx`, `src/p2p-experimental/pages/DiseaseProgressionExperimentalPage.tsx`, `e2e/plant-models.spec.ts`; Create `PROJECT_DETAILS/Project Reports/Phase 4 Reports/PHASE_4B_VALIDATION.md`.

**Interfaces:** `resolveProgressionLink(cropId: PlantModelId, diseaseKey: string): string|null`; `validateProgressionSelection(route: string, crop: string|null, disease: string|null): {cropId: string; diseaseKey: string}|null`. İzinli tablo ana ve deneysel manifestin gerçek hastalıklarıyla doldurulur; tablo yeni hastalık desteği yaratmaz.

- [ ] Testler yaz: tomato/early-blight doğru ana URL; tomato/fusarium null; wheat/any null; pepper için mevcut deneysel manifestle eşleşen hastalık doğru deneysel URL; geçersiz query açık hata. Query yoksa eski sayfa varsayılan davranışı korunur.
- [ ] `npm run test:plants`: FAIL; eşleme tablosunu ve hedef sayfalarda query okuma/validasyonu uygula. URL back/forward değişiklikleri state'e yansısın; eşleşmeyen query sessizce tomato seçmesin. UI crop seçimi varsa query'yi de senkronize et veya query'yi temizle.
- [ ] E2E: pinden bağlantıya, doğru bitki/hastalık seçimine ve geri navigasyonuna geç; desteklenmeyen bağlantının sunulmadığını kontrol et.
- [ ] `npm run test:plants`, `npm run test:plants:e2e`, `npm run test:assets`, `npm run test:crops`, `npm run build`, `npm run lint` sonuçlarını ve B görsel/erişilebilirlik kabulünü raporla. Commit: `feat: connect verified anatomy disease progression links`.

## Uygulama sırası ve teslim

Görev 1 → Görev 2 pilot varlık → Görev 3 → Görev 2 kalan varlıklar → Görev 4 ile A teslimi. Kullanıcı B çalışmasını istediğinde Görev 5 → Görev 6. API/veritabanı C aşaması ayrıca planlanır. Mevcut rapor klasöründe kullanıcıya ait untracked dosyalar bulunduğu için commit sırasında yalnız görev dosyaları seçilir; `git add .` kullanılmaz.

Bu planın en büyük dış bağımlılığı sekiz lisanslı ve anatomik olarak uygun modeldir. İlk uygulama adımı tüm modelleri bulmuş gibi davranmak değil, tek modelin indirme iznini ve tarayıcıda gerçek görünümünü doğrulamaktır.
