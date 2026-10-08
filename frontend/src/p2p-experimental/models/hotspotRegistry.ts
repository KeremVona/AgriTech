/**
 * Symptom Hotspots Registry for Leaf Disease Progression
 * Precision AgriTech Platform - P2P Experimental (Tier 1, Feature 2)
 *
 * Defines biologically registered anatomical coordinates (x, y % on 800x800 plate)
 * and detailed pathological microscopy descriptions for all 4 target crops:
 * - Tomato Early Blight (Alternaria solani)
 * - Potato Late Blight (Phytophthora infestans)
 * - Corn Common Rust (Puccinia sorghi)
 * - Apple Scab (Venturia inaequalis)
 */

import type { SupportedCropId } from './agronomicTimelineModel';

export interface SymptomHotspot {
  id: string;
  cropId: SupportedCropId;
  title: string;
  subtitle: string;
  xPct: number;              // Horizontal coordinate (0 - 100%) on 800x800 foliar viewport
  yPct: number;              // Vertical coordinate (0 - 100%) on 800x800 foliar viewport
  minSliderPct: number;      // Emergence threshold (% infection where marker reveals)
  maxSliderPct?: number;      // Upper threshold (optional, default 100%)
  stageOrder: 0 | 1 | 2;
  badgeLabel: string;
  badgeColor: 'emerald' | 'amber' | 'red' | 'purple';
  pathogenStructure: string;
  anatomicalDescription: string;
  physiologicalImpact: string;
  treatmentAdvisory: string;
}

export const SYMPTOM_HOTSPOTS_REGISTRY: Record<SupportedCropId, SymptomHotspot[]> = {
  tomato: [
    {
      id: 'tomato-target-rings',
      cropId: 'tomato',
      title: 'Target-Board Concentric Rings',
      subtitle: 'Alternaria solani Conidiophore Sporulation Zone',
      xPct: 48,
      yPct: 44,
      minSliderPct: 30.0,
      stageOrder: 1,
      badgeLabel: 'Stage 1 • Diagnostic Key',
      badgeColor: 'amber',
      pathogenStructure: 'Multicellular, beaked brown conidia borne on erect conidiophores.',
      anatomicalDescription:
        'Concentric ridges develop as fungal mycelium alternates between diurnal vegetative growth and nocturnal sporulation bursts in leaf mesophyll.',
      physiologicalImpact:
        'Disrupts palisade parenchyma; local intercellular collapse causes light reflection anomalies visible as target rings.',
      treatmentAdvisory:
        'FRAC Group 11 (Azoxystrobin) or FRAC Group 3 (Difenoconazole). Apply prior to rain events.',
    },
    {
      id: 'tomato-chlorotic-halo',
      cropId: 'tomato',
      title: 'Chlorotic Yellow Halo',
      subtitle: 'Alternaric Acid Phytotoxin Diffusion Zone',
      xPct: 62,
      yPct: 38,
      minSliderPct: 35.0,
      stageOrder: 1,
      badgeLabel: 'Stage 1 • Toxin Margin',
      badgeColor: 'amber',
      pathogenStructure: 'Alternaric acid & solanapyrone low-molecular-weight host-selective toxins.',
      anatomicalDescription:
        'A diffuse bright yellow halo extending 1–3 mm beyond the necrotic core, marking where diffusible fungal phytotoxins advance ahead of live hyphae.',
      physiologicalImpact:
        'Causes chlorophyll a/b degradation, potassium leakage, and uncoupling of photophosphorylation in healthy chloroplasts.',
      treatmentAdvisory:
        'FRAC Group M01 (Copper Hydroxide) protective barrier on non-infected foliar lamina.',
    },
    {
      id: 'tomato-marginal-defoliation',
      cropId: 'tomato',
      title: 'Marginal Tissue Collapse & Defoliation',
      subtitle: 'Terminal Blight Abscission Zone',
      xPct: 32,
      yPct: 68,
      minSliderPct: 72.0,
      stageOrder: 2,
      badgeLabel: 'Stage 2 • Severe Blight',
      badgeColor: 'red',
      pathogenStructure: 'Coalescent necrotic hyphae colonizing petiole vascular bundles.',
      anatomicalDescription:
        'Extensive brown-black necrotic blotches coalescing across leaf margins, causing foliar curling, crisp parchment drying, and premature abscission.',
      physiologicalImpact:
        'Total loss of photosynthetic leaf area index (LAI); petiole vascular occlusion leads to irreversible foliar shriveling.',
      treatmentAdvisory:
        'Immediate systemic fungicide intervention (Boscalid + Pyraclostrobin); sanitize defoliated leaf debris.',
    },
  ],

  potato: [
    {
      id: 'potato-water-soaked-lesion',
      cropId: 'potato',
      title: 'Water-Soaked Marginal Lesion',
      subtitle: 'Phytophthora infestans Zoospore Penetration',
      xPct: 52,
      yPct: 32,
      minSliderPct: 30.0,
      stageOrder: 1,
      badgeLabel: 'Stage 1 • Infection Core',
      badgeColor: 'amber',
      pathogenStructure: 'Biflagellate zoospores producing appressoria and penetration pegs.',
      anatomicalDescription:
        'Pale, translucent, water-soaked fleck on leaf margin where swimming zoospores encysted in morning condensation droplets.',
      physiologicalImpact:
        'Hyphae grow intercellularly with digit-like haustoria penetrating host mesophyll cells, siphoning carbohydrates without initial cell lysis.',
      treatmentAdvisory:
        'FRAC Group 4 (Mefenoxam / Metalaxyl-M) or FRAC Group 28 (Propamocarb). Apply at first regional alert.',
    },
    {
      id: 'potato-white-mildew-spores',
      cropId: 'potato',
      title: 'Abaxial Sporulation Halos',
      subtitle: 'Downy White Sporangiophores Eruption',
      xPct: 65,
      yPct: 54,
      minSliderPct: 48.0,
      stageOrder: 1,
      badgeLabel: 'Stage 1 • Spore Cloud',
      badgeColor: 'purple',
      pathogenStructure: 'Compound sympodial sporangiophores bearing lemon-shaped deciduous sporangia.',
      anatomicalDescription:
        'Delicate, white velvety fungal down erupting through stomatal openings on the underside of the leaf during high relative humidity (>90%).',
      physiologicalImpact:
        'Releases up to 300,000 wind-borne sporangia per lesion per day, capable of infecting nearby fields within hours.',
      treatmentAdvisory:
        'FRAC Group 40 (Dimethomorph) or FRAC Group 21 (Cyazofamid). Halt overhead sprinkler irrigation immediately.',
    },
    {
      id: 'potato-necrotic-blight-collapse',
      cropId: 'potato',
      title: 'Catastrophic Necrotic Collapse',
      subtitle: 'Terminal Foliar Blight & Petiole Rot',
      xPct: 35,
      yPct: 62,
      minSliderPct: 75.0,
      stageOrder: 2,
      badgeLabel: 'Stage 2 • Terminal Blight',
      badgeColor: 'red',
      pathogenStructure: 'Endophytic necrotrophic transition with complete enzymatic tissue lysis.',
      anatomicalDescription:
        'Dark purplish-black necrotic collapse of the entire leaf blade. Leaf turns limp, slimy in wet weather, or crisp and scorched in dry weather.',
      physiologicalImpact:
        'Complete cellular membrane dissolution and release of foul-smelling secondary bacterial breakdown odors.',
      treatmentAdvisory:
        'Harvest haulm desiccation (diquat) if tubers are mature; apply systemic cymoxanil kick-back spray.',
    },
  ],

  corn: [
    {
      id: 'corn-chlorotic-flecking',
      cropId: 'corn',
      title: 'Substomatal Chlorotic Flecks',
      subtitle: 'Early Urediniospore Colonization',
      xPct: 46,
      yPct: 28,
      minSliderPct: 25.0,
      stageOrder: 0,
      badgeLabel: 'Stage 0 • Latent Phase',
      badgeColor: 'emerald',
      pathogenStructure: 'Substomatal vesicle forming primary infection hyphae inside parallel veins.',
      anatomicalDescription:
        'Small, circular to elongated yellow-green chlorotic specks scattered along linear leaf blade veins prior to epidermal rupture.',
      physiologicalImpact:
        'Obligate biotrophic nourishment via intercellular haustoria in bundle sheath cells; low initial photosynthetic disruption.',
      treatmentAdvisory:
        'Scout lower canopy (leaves below ear leaf). Evaluate hybrid genetic resistance (Rp gene cultivars).',
    },
    {
      id: 'corn-cinnamon-pustule',
      cropId: 'corn',
      title: 'Cinnamon-Brown Uredinial Pustule',
      subtitle: 'Puccinia sorghi Repeating Spore Eruption',
      xPct: 53,
      yPct: 52,
      minSliderPct: 35.0,
      stageOrder: 1,
      badgeLabel: 'Stage 1 • Active Pustule',
      badgeColor: 'amber',
      pathogenStructure: 'Finely echinulate, golden-brown dikaryotic urediniospores in ruptured sorus.',
      anatomicalDescription:
        'Prominently raised, oval-to-elongate powdery cinnamon-brown pustules erupting through both upper and lower epidermal surfaces.',
      physiologicalImpact:
        'Mechanical rupture of the waxy cuticle increases uncontrolled transpiration by up to 300%, causing severe midday moisture stress.',
      treatmentAdvisory:
        'FRAC Group 3 + FRAC Group 11 premix (Pyraclostrobin + Metconazole) if pustules cover >1% of ear leaf area before dent stage (R5).',
    },
    {
      id: 'corn-telia-coalescence',
      cropId: 'corn',
      title: 'Telia Coalescence & Vein Scorch',
      subtitle: 'Overwintering Teliospore Desiccation',
      xPct: 38,
      yPct: 74,
      minSliderPct: 74.0,
      stageOrder: 2,
      badgeLabel: 'Stage 2 • Severe Scorch',
      badgeColor: 'red',
      pathogenStructure: 'Two-celled, dark brown-black thick-walled teliospores with persistent pedicels.',
      anatomicalDescription:
        'Pustules turn dark chocolate brown to black as the fungus shifts from repeating urediniospores to overwintering teliospores; leaf blade desiccates into brittle strips.',
      physiologicalImpact:
        'Premature leaf senescence and extensive necrotic scorched bands causing ear fill abortion and stalk lodging.',
      treatmentAdvisory:
        'Post-tassel fungicide threshold exceeded; evaluate stalk integrity for early harvest to prevent lodging.',
    },
  ],

  apple: [
    {
      id: 'apple-subcuticular-stroma',
      cropId: 'apple',
      title: 'Subcuticular Stroma Proliferation',
      subtitle: 'Venturia inaequalis Latent Incubation',
      xPct: 45,
      yPct: 35,
      minSliderPct: 20.0,
      stageOrder: 0,
      badgeLabel: 'Stage 0 • Primary Stroma',
      badgeColor: 'emerald',
      pathogenStructure: 'Subcuticular stroma network growing horizontally between cuticle and epidermis.',
      anatomicalDescription:
        'Diffuse, faint pale green discoloration visible only under backlighting; fungus multiplies without puncturing epidermal cell walls.',
      physiologicalImpact:
        'Absorbs nutrients through pectinaceous wall layers without triggering immediate plant hypersensitive response.',
      treatmentAdvisory:
        'Calculate Mills Degree-Day wetness period. Apply kick-back curative fungicide (Difenoconazole) within 72 hours.',
    },
    {
      id: 'apple-velvety-scab-spot',
      cropId: 'apple',
      title: 'Velvety Olive-Green Scab Spot',
      subtitle: 'Conidiophores Bursting Epidermal Cuticle',
      xPct: 56,
      yPct: 48,
      minSliderPct: 32.0,
      stageOrder: 1,
      badgeLabel: 'Stage 1 • Velvety Spot',
      badgeColor: 'amber',
      pathogenStructure: 'Flame-shaped brownish conidiophores bearing Spilocaea pomi conidia.',
      anatomicalDescription:
        'Circular, dull olive-green to smoky black velvety spot with distinct feathered margins where conidia rupture the cuticle.',
      physiologicalImpact:
        'Causes leaf blade buckling, cupping, and crinkling due to differential expansion rates between infected and healthy tissue.',
      treatmentAdvisory:
        'FRAC Group 9 (Cyprodinil) or FRAC Group 7 (Fluxapyroxad) before secondary rain infection cycles.',
    },
    {
      id: 'apple-corky-necrosis',
      cropId: 'apple',
      title: 'Corky Scab Necrosis & Leaf Abscission',
      subtitle: 'Cuticular Hardening & Lamina Distortion',
      xPct: 36,
      yPct: 66,
      minSliderPct: 75.0,
      stageOrder: 2,
      badgeLabel: 'Stage 2 • Corky Necrosis',
      badgeColor: 'red',
      pathogenStructure: 'Melanized subcuticular stromata initiating host periderm suberization.',
      anatomicalDescription:
        'Old velvety lesions turn dark brown, thick, and corky; leaf lamina becomes puckered, distorted, and chlorotic, leading to premature leaf drop.',
      physiologicalImpact:
        'Premature foliar defoliation starves developing fruit of carbohydrates, stunting fruit size and exposing apples to direct scab infection.',
      treatmentAdvisory:
        'Autumn post-harvest 5% urea foliar spray and shredded leaf sanitation to accelerate winter leaf breakdown.',
    },
  ],
  grape: [
    {
      id: 'grape-subcuticular-fleck',
      cropId: 'grape',
      title: 'Subcuticular Translucent Pinhead Fleck',
      subtitle: 'Guignardia bidwellii Appressorial Ingress',
      xPct: 50,
      yPct: 40,
      minSliderPct: 15.0,
      stageOrder: 0,
      badgeLabel: 'Stage 0 • Incipient Infection',
      badgeColor: 'emerald',
      pathogenStructure: 'Melanized appressorium and sub-cuticular bulbous infection hypha.',
      anatomicalDescription:
        'Minute translucent chlorotic dot breaching the waxy cuticle of young expanding leaves between minor veins.',
      physiologicalImpact:
        'Localized disruption of upper epidermal cells prior to mesophyll lysis; cuticle integrity compromised.',
      treatmentAdvisory:
        'Preventative multi-site contact protectant (Mancozeb FRAC M03) before rainfall; 72h kickback DMI if wet.',
    },
    {
      id: 'grape-chocolate-ring-lesion',
      cropId: 'grape',
      title: 'Chocolate-Brown Lesion with Pycnidial Rings',
      subtitle: 'Phyllosticta ampelicida Conidiogenesis',
      xPct: 45,
      yPct: 55,
      minSliderPct: 35.0,
      stageOrder: 1,
      badgeLabel: 'Stage 1 • Diagnostic Key',
      badgeColor: 'amber',
      pathogenStructure: 'Subepidermal ostiolate pycnidia exuding mucilaginous single-celled Phyllosticta conidia cirrhi.',
      anatomicalDescription:
        'Reddish-brown necrotic spot with sharp dark borders and a distinct concentric ring of raised black pycnidia.',
      physiologicalImpact:
        'Palisade parenchyma necrosis; secondary rain-splash conidia discharge into surrounding canopy cluster zones.',
      treatmentAdvisory:
        'Curative DMI (Difenoconazole FRAC 3) + Strobilurin (Azoxystrobin FRAC 11) to arrest mycelial growth and sporulation.',
    },
    {
      id: 'grape-coalescent-blight-mummy',
      cropId: 'grape',
      title: 'Coalescent Foliar Blight & Berry Mummies',
      subtitle: 'Terminal Necrosis & Pseudothecia Stroma',
      xPct: 35,
      yPct: 65,
      minSliderPct: 75.0,
      stageOrder: 2,
      badgeLabel: 'Stage 2 • Severe Blight',
      badgeColor: 'red',
      pathogenStructure: 'Dense stroma forming overwintering pseudothecia in desiccated fruit pericarps.',
      anatomicalDescription:
        'Lamina blight, petiole girdling, and complete shriveling of berries into hard, wrinkled black mummies.',
      physiologicalImpact:
        'Complete loss of photosynthetic capacity; vascular bundle occlusion; total destruction of harvestable cluster yield.',
      treatmentAdvisory:
        'Eradicant strobilurin combination + mandatory winter vineyard sanitation and removal of hanging mummies.',
    },
  ],
  pepper: [
    {
      id: 'pepper-abaxial-water-soaked',
      cropId: 'pepper',
      title: 'Abaxial Water-Soaked Pinpoint Macule',
      subtitle: 'Xanthomonas euvesicatoria Substomatal Colonization',
      xPct: 52,
      yPct: 38,
      minSliderPct: 15.0,
      stageOrder: 0,
      badgeLabel: 'Stage 0 • Stomatal Ingress',
      badgeColor: 'emerald',
      pathogenStructure: 'Motile flagellated bacteria colonizing substomatal apoplastic cavities.',
      anatomicalDescription:
        'Tiny water-soaked greasy translucent flecks on the lower leaf surface, appearing before upper epidermal symptoms.',
      physiologicalImpact:
        'Type III secretion system effectors stimulate apoplastic electrolyte and water leakage across mesophyll cells.',
      treatmentAdvisory:
        'Apply systemic SAR inducer (Actigard FRAC P01) or AgriPhage bacteriophages; avoid overhead irrigation.',
    },
    {
      id: 'pepper-angular-necrotic-halo',
      cropId: 'pepper',
      title: 'Angular Brown Spot with Chlorotic Halo',
      subtitle: 'Apoplastic Lysis & Bacterial Streaming',
      xPct: 46,
      yPct: 52,
      minSliderPct: 35.0,
      stageOrder: 1,
      badgeLabel: 'Stage 1 • Diagnostic Key',
      badgeColor: 'amber',
      pathogenStructure: 'Dense bacterial populations exhibiting streaming ooze from ruptured vascular boundaries.',
      anatomicalDescription:
        'Vein-limited angular dark brown lesions surrounded by a diffuse bright yellow chlorotic margin.',
      physiologicalImpact:
        'Destruction of mesophyll chloroplasts; high bacterial multiplication and aerosolized rain-splash dispersal.',
      treatmentAdvisory:
        'Copper Hydroxide (FRAC M01) + Mancozeb (FRAC M03) synergistic tank-mix to overcome copper-tolerant strains.',
    },
    {
      id: 'pepper-abscission-defoliation',
      cropId: 'pepper',
      title: 'Greasy Blight & Toxic Petiole Abscission',
      subtitle: 'Ethylene-Induced Leaf Drop & Sunscald',
      xPct: 38,
      yPct: 70,
      minSliderPct: 72.0,
      stageOrder: 2,
      badgeLabel: 'Stage 2 • Severe Defoliation',
      badgeColor: 'red',
      pathogenStructure: 'Vascular necrosis and petiole abscission layer degradation.',
      anatomicalDescription:
        'Lesions coalesce into ragged dead areas; leaves turn bright yellow and drop in mass from plant canopies.',
      physiologicalImpact:
        'Catastrophic canopy loss exposes pepper fruit to irreversible sunscald and severe marketable yield loss.',
      treatmentAdvisory:
        'Sanitize dropped leaf litter; apply protectants to guard emerging vegetative flushes and fruit calyxes.',
    },
  ],
  peach: [
    {
      id: 'peach-polygonal-water-soaked',
      cropId: 'peach',
      title: 'Polygonal Abaxial Water-Soaked Fleck',
      subtitle: 'Xanthomonas arboricola pv. pruni Entry',
      xPct: 48,
      yPct: 35,
      minSliderPct: 15.0,
      stageOrder: 0,
      badgeLabel: 'Stage 0 • Spongy Parenchyma Entry',
      badgeColor: 'emerald',
      pathogenStructure: 'Epiphytic bacteria entering stomata via wind-blown water droplets.',
      anatomicalDescription:
        'Pale green-to-yellow polygonal water-soaked spots along the midrib and leaf tip on the foliar underside.',
      physiologicalImpact:
        'Intercellular bacterial division in spongy parenchyma with early electrolyte leakage and stomatal dysfunction.',
      treatmentAdvisory:
        'Delayed-dormant fixed copper at bud-swell; low-rate copper or oxytetracycline starting at petal fall.',
    },
    {
      id: 'peach-shot-hole-perforation',
      cropId: 'peach',
      title: 'Shot-Hole Abscission Perforation',
      subtitle: 'Host Periderm Defense & Tissue Drop-out',
      xPct: 54,
      yPct: 50,
      minSliderPct: 35.0,
      stageOrder: 1,
      badgeLabel: 'Stage 1 • Diagnostic Key',
      badgeColor: 'amber',
      pathogenStructure: 'Necrotic bacterial pocket walled off by host suberin/lignin periderm abscission zone.',
      anatomicalDescription:
        'Purplish-black angular spots whose dead centers dry, crack, and drop out, leaving clean circular perforations.',
      physiologicalImpact:
        'Loss of functional photosynthetic lamina area; localized tissue senescence; secondary bacterial cankers on twigs.',
      treatmentAdvisory:
        'Oxytetracycline (FRAC 41) or weekly micro-rate copper hydroxide (FRAC M01) from shuck split to pit hardening.',
    },
    {
      id: 'peach-apical-defoliation-canker',
      cropId: 'peach',
      title: 'Apical Shoot Defoliation & Twig Cankers',
      subtitle: 'Canopy Stripping & Bacterial Gum Exudate',
      xPct: 32,
      yPct: 68,
      minSliderPct: 75.0,
      stageOrder: 2,
      badgeLabel: 'Stage 2 • Severe Blight',
      badgeColor: 'red',
      pathogenStructure: 'Cortical twig necrosis and vascular petiole occlusion.',
      anatomicalDescription:
        'Leaves shed heavily from twig bases leaving tufted tips; twigs develop sunken gummy cankers with pitted fruit.',
      physiologicalImpact:
        'Severe reduction in carbohydrate storage and marketability of pocked fruit; weakened scaffold branches.',
      treatmentAdvisory:
        'Prune out blighted twigs during dry weather; apply post-harvest copper at 50% autumn leaf fall.',
    },
  ],
  squash: [
    {
      id: 'squash-shaded-talcum-speck',
      cropId: 'squash',
      title: 'Shaded Abaxial Talcum Speck',
      subtitle: 'Podosphaera xanthii Epiphytic Germination',
      xPct: 50,
      yPct: 42,
      minSliderPct: 15.0,
      stageOrder: 0,
      badgeLabel: 'Stage 0 • Primary Colony',
      badgeColor: 'emerald',
      pathogenStructure: 'Conidial germ tube with globose haustoria in epidermal cells.',
      anatomicalDescription:
        'Faint circular white powdery specks on the lower leaf surface and interior crown leaves without free water.',
      physiologicalImpact:
        'Parasitism of host epidermal cells for carbohydrate absorption; suppression of localized defense responses.',
      treatmentAdvisory:
        'Horticultural stylet oil or translaminar DMI fungicide at first detection of lower-surface colonies.',
    },
    {
      id: 'squash-powdery-conidial-mat',
      cropId: 'squash',
      title: 'Coalescing Powdery Pustule Mats',
      subtitle: 'Active Airborne Conidiogenesis',
      xPct: 46,
      yPct: 56,
      minSliderPct: 35.0,
      stageOrder: 1,
      badgeLabel: 'Stage 1 • Diagnostic Key',
      badgeColor: 'amber',
      pathogenStructure: 'Dense erect conidiophores with barrel-shaped conidia containing fibrosin bodies.',
      anatomicalDescription:
        'Talcum-like white fungal mats expanding over upper and lower leaf surfaces, petioles, and main runners.',
      physiologicalImpact:
        'Severe chlorophyll shading and reduction in net photosynthetic assimilation; accelerated foliar respiration.',
      treatmentAdvisory:
        'Rotate Cyflufenamid (FRAC U06), Fluopyram (FRAC 7), or Potassium Bicarbonate to prevent resistance.',
    },
    {
      id: 'squash-parchment-canopy-collapse',
      cropId: 'squash',
      title: 'Parchment Lamina Desiccation & Collapse',
      subtitle: 'Terminal Canopy Scorch & Fruit Sunscald',
      xPct: 36,
      yPct: 68,
      minSliderPct: 75.0,
      stageOrder: 2,
      badgeLabel: 'Stage 2 • Terminal Blight',
      badgeColor: 'red',
      pathogenStructure: 'Exhausted mycelial felt; optional overwintering dark chasmothecia.',
      anatomicalDescription:
        'Lamina becomes pale yellow, brown, and brittle like parchment paper; petiole collapses completely.',
      physiologicalImpact:
        'Total foliar senescence; unshaded squash fruit suffer sunburn, cracking, and premature ripening.',
      treatmentAdvisory:
        'Maintain drip irrigation; apply protectants to emerging crown foliage; disk residue immediately after harvest.',
    },
  ],
};

/**
 * Filters hotspots for a crop that are visible at a given slider percentage.
 */
export function getActiveHotspotsForProgress(
  cropId: SupportedCropId,
  sliderPct: number
): SymptomHotspot[] {
  const cropHotspots = SYMPTOM_HOTSPOTS_REGISTRY[cropId] || [];
  return cropHotspots.filter(
    (h) => sliderPct >= h.minSliderPct && sliderPct <= (h.maxSliderPct ?? 100.0)
  );
}
