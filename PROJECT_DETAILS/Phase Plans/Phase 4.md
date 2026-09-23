## Phase 4: Interactive 3D Plant Anatomy Explorer (Feature #2)

Phase 4 establishes an interactive WebGL-based educational and diagnostic inspection module. It translates foliar and systemic agricultural diseases into spatial, three-dimensional anatomical models. Field workers and agronomists can rotate, pan, and zoom through realistic crop models, inspect interactive hotspots on distinct anatomical regions (leaf blade, petiole, stem/stalk, and root collar), and correlate external foliar symptoms with internal vascular pathologies.

### Technical Specifications & Architecture

#### 1. 3D Asset Pipeline & Geometry Optimization

- **Supported Species:** Tomato (_Solanum lycopersicum_), Corn/Maize (_Zea mays_), and Apple/Grapevine.
    
- **Asset Format:** Binary glTF (`.glb`) with embedded geometry buffers and PBR (Physically Based Rendering) texture maps.
    
- **Optimization Budget:**
    
    - Target raw uncompressed polycount: $30{,}000$ to $50{,}000$ triangles per specimen.
        
    - Geometry compression: **Google Draco** compression algorithm applied via `gltf-pipeline` or Blender export presets, reducing mesh payloads by up to $80\%$.
        
    - Textures: Base color (albedo), normal map, and combined roughness/metallic/AO maps formatted as WebP or KTX2/Basis Universal textures ($1024 \times 1024$ resolution).
        
    - Asset Size Target: Total compressed `.glb` payload $\le 3.5\text{ MB}$ per crop to ensure rapid asset streaming over field mobile connections.
        

#### 2. Rendering Engine & Camera Rigging (React Three Fiber)

- **Framework:** React Three Fiber (`@react-three/fiber`) wrapped with helper primitives from `@react-three/drei`.
    
- **Rendering Pipeline:**
    
    - Tone Mapping: ACES Filmic Tone Mapping with balanced exposure to render realistic foliar greens.
        
    - Lighting Rig: Three-point studio lighting comprising a directional sun key light casting soft directional shadows, an ambient sky fill light, and a subtle rim light to delineate plant silhouette margins.
        
    - Bounding Box Auto-Centering: Compute the three-dimensional axis-aligned bounding box ($\text{AABB}$) on asset load to auto-frame the camera perspective regardless of mesh origin offsets:
        
        $$\text{Center} = \frac{\mathbf{v}_{\max} + \mathbf{v}_{\min}}{2}, \quad \text{Radius} = \frac{\Vert{}\mathbf{v}_{\max} - \mathbf{v}_{\min}\Vert{}}{2}$$
        
    - Camera Controls: OrbitControls with constrained polar elevation angles ($10^\circ \le \theta \le 85^\circ$) to prevent camera clipping below ground level.
        

#### 3. Spatial Raycasting & Vertex Pin Projection

- **Hotspot Placement:** Interactive pins anchored directly to labeled mesh regions:
    
    - `foliage_upper`: Upper leaf canopy (blights, rusts, foliar mold).
        
    - `stem_vascular`: Lower stem and xylem/phloem nodes (vascular wilts, cankers).
        
    - `root_collar`: Crown, adventitious roots, and taproot interface (root rots, damping-off).
        
    - `fruit_calyx`: Developing fruit nodes (blossom end rot, anthracnose).
        
- **Screen-Space Projection:** Convert local 3D mesh coordinates $\mathbf{P}_{\text{world}} = (X, Y, Z)$ into normalized device coordinates (NDC) and project them onto the 2D viewport:
    
    $$\mathbf{P}_{\text{ndc}} = \mathbf{M}_{\text{proj}} \cdot \mathbf{M}_{\text{view}} \cdot \mathbf{M}_{\text{world}} \cdot \begin{bmatrix} X \\ Y \\ Z \\ 1 \end{bmatrix}$$
    
    $$\begin{bmatrix} x_{\text{screen}} \\ y_{\text{screen}} \end{bmatrix} = \begin{bmatrix} \frac{\mathbf{P}_{\text{ndc}, x} + 1}{2} \cdot W \\ \frac{1 - \mathbf{P}_{\text{ndc}, y}}{2} \cdot H \end{bmatrix}$$
    
    where $W$ and $H$ represent viewport width and height in pixels.
    
- **Occlusion Culling:** A raycaster checks line-of-sight between camera $\mathbf{C}$ and hotspot coordinate $\mathbf{P}_{\text{world}}$. If another mesh face intercepts the ray closer than $\Vert{}\mathbf{P}_{\text{world}} - \mathbf{C}\Vert{}$, dim the pin opacity or mark it occluded.
    

#### 4. Anatomical Knowledge Schema & Payload Contract

Each interactive pin links to structured agronomic records retrieved on demand:

JSON

```
{
  "pin_id": "pin-tom-stem-01",
  "crop_id": "tomato",
  "anatomical_zone": "Stem / Vascular Bundle",
  "coordinates": { "x": 0.024, "y": 0.412, "z": -0.015 },
  "associated_pathologies": [
    {
      "disease_name": "Fusarium Wilt",
      "pathogen": "Fusarium oxysporum f. sp. lycopersici",
      "pathology_type": "Fungal / Soil-borne",
      "internal_symptom": "Brown discoloration of xylem vascular ring visible upon cross-section incision.",
      "external_symptom": "Unilateral leaf yellowing on lower branches progressing upward.",
      "histological_description": "Hyphae invade through root cortex, colonizing xylem vessels and triggering tyloses that block water transport.",
      "microscopic_image_url": "/assets/anatomy/fusarium_xylem_cross.webp"
    },
    {
      "disease_name": "Bacterial Canker",
      "pathogen": "Clavibacter michiganensis",
      "pathology_type": "Bacterial",
      "internal_symptom": "Pith breakdown and yellowish-brown vascular streaking.",
      "external_symptom": "Bird's-eye spots on fruit; wilting of lower leaflet margins.",
      "histological_description": "Systemic bacterial colonization of stem vascular elements causing cavitation.",
      "microscopic_image_url": "/assets/anatomy/canker_stem_streak.webp"
    }
  ]
}
```

### Team Project Board TODOs

#### Track A: 3D Asset Engineering & Mesh Optimization

##### TODO-401: 3D Plant Asset Acquisition, Topology Cleanup, and Rigging

- **Assignee:** 3D Artist / Technical Artist
    
- **Description:** Procure or model low-to-medium poly representations of Tomato, Corn, and Apple specimens. Ensure structural separation between foliage, main stalks, and root collars.
    
- **Deliverables:**
    
    - Clean `.glb` assets for Tomato, Corn, and Apple crops.
        
    - Normalized scene hierarchy: discrete mesh groups labeled `mesh_canopy`, `mesh_stem`, and `mesh_roots`.
        
    - Asset scale normalized to realistic metric units ($1.0\text{ Three.js unit} = 1.0\text{ meter}$).
        
- **Acceptance Criteria:**
    
    - Triangular face count strictly under $45{,}000$ per model.
        
    - Zero non-manifold geometry, duplicate vertices, or unapplied rotation/scale transforms.
        

##### TODO-402: Draco Mesh Compression & PBR Material Baking

- **Assignee:** 3D Technical Artist / Frontend Engineer
    
- **Description:** Apply Draco geometric compression and convert textures to GPU-compressed web standards to ensure low network transfer footprints.
    
- **Deliverables:**
    
    - Compression pipeline script `scripts/compress_models.sh` running `gltf-pipeline` with Draco flags.
        
    - Single PBR material per plant utilizing packed textures (R = Ambient Occlusion, G = Roughness, B = Metallic).
        
- **Acceptance Criteria:**
    
    - Compressed model files (`.glb`) do not exceed $3.5\text{ MB}$ total download size.
        
    - Draco decompression unpacks in $< 300\text{ ms}$ on mobile browsers.
        

#### Track B: WebGL & React Three Fiber Engine

##### TODO-403: Core 3D Scene, Lighting Rig, and Orbit Control Rigging

- **Assignee:** Frontend Engineer (Graphics Focus)
    
- **Description:** Implement the Three.js viewport canvas with studio lighting, camera framing, and touch-friendly controls.
    
- **Deliverables:**
    
    - React component `<PlantAnatomyCanvas cropType="{selectedCrop}"/>` using `@react-three/fiber`.
        
    - Custom camera controller centering the camera automatically on the calculated mesh bounding box center.
        
    - Responsive resize observer maintaining correct camera aspect ratios without stretching on window resize.
        
- **Acceptance Criteria:**
    
    - Canvas maintains consistent 60 FPS rendering on modern integrated graphics.
        
    - Orbit controls allow smooth rotation, panning, and zoom with dampening, preventing camera inverted clipping under the ground plane.
        

##### TODO-404: 3D Hotspot Raycaster & Dynamic Pin Projection

- **Assignee:** Frontend Engineer (Graphics Focus)
    
- **Description:** Construct the interactive raycasting engine that projects 3D spatial points into clickable 2D HTML/SVG overlay pins with occlusion awareness.
    
- **Deliverables:**
    
    - Component `<AnatomyHotspot label="{title}" position="{[x," y, z]}/>` using Drei's `<Html/>` or custom screen projection.
        
    - Occlusion testing using `THREE.Raycaster` to reduce opacity or hide pins obscured behind stem or leaf geometry.
        
    - Smooth animated camera transition (`gsap` or `react-spring`) focusing and zooming toward the selected anatomical pin upon click.
        
- **Acceptance Criteria:**
    
    - Clicking an annotation pin zooms the camera directly to that plant part within 800ms.
        
    - Pins remain visually pinned to the correct mesh vertex coordinates across arbitrary camera rotations.
        

#### Track C: Frontend Integration & Pathology Viewer UI

##### TODO-405: Anatomical Pathology Data Engine & API Integration

- **Assignee:** Backend / Agronomy Lead
    
- **Description:** Make the API endpoints and static data structures providing internal tissue breakdown, microscopic cross-sections, and disease associations per plant part.
    
- **Deliverables:**
    
    - Static JSON or DB dataset `data/plant_anatomy_markers.json` documenting anatomical regions across all supported crops.
        
    - API route `GET /api/v1/crops/{cropId}/anatomy-markers` returning 3D coordinate anchors and associated systemic pathologies.
        
    - High-resolution reference imagery illustrating vascular browning, cankers, and internal foliar rot.
        
- **Acceptance Criteria:**
    
    - Every pin coordinate matches verified visual locations on the corresponding 3D models.
        
    - Payload includes symptom markers, biological pathogen names, and microscopic tissue images.
        

##### TODO-406: Anatomy Inspection Card & Dissection Drawer UI

- **Assignee:** Frontend / UI Engineer
    
- **Description:** Build the slide-over inspection modal displaying comprehensive disease details and histological illustrations when an anatomical pin is selected.
    
- **Deliverables:**
    
    - UI component `<AnatomyDetailDrawer onClose="{...}" pinData="{activePin}"/>` styled with Tailwind CSS.
        
    - Tabbed layout switching between "Macro Foliar Symptoms" and "Vascular / Histological Pathology".
        
    - Integrated "View Progression" button that routes the user directly to Feature #1 (Disease Progression Slider) for that specific diagnosed disease.
        
- **Acceptance Criteria:**
    
    - Selecting a pin immediately slides open the detail drawer without UI hitching or dropping WebGL canvas frame rates.
        
    - Clean keyboard accessibility (Escape closes modal, Tab cycles focus across pins).