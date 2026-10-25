/**
 * Core WebGL & Canvas 2D Blending Engine for Leaf Disease Progression (SPEC-UI-007, TODO-112).
 * Executes a two-phase fragment shader blend:
 * - Slider 0 -> 50%: Cross-dissolve Stage 0 (Healthy) to Stage 1 (Early) with localized chlorosis masking.
 * - Slider 51 -> 100%: Cross-dissolve Stage 1 to Stage 2 (Severe) with high-pass necrotic reveal.
 * 
 * Supports 3 Interactive View Modes:
 * - 'rgb': Photorealistic blended foliar surface.
 * - 'attention': 3-stop Bio-Agronomic heatmap (#0F766E Teal -> #F59E0B Amber -> #DC2626 Alert Red).
 * - 'mask': High-contrast isolated lesion mask with foliar silhouette alpha preservation.
 * 
 * Supports Split Curtain Compare:
 * - Splits canvas horizontally between healthy Stage 0 baseline and current progression state.
 * 
 * Includes graceful HTML5 2D Canvas fallback and full context disposal for zero memory leaks.
 */

import type { ProgressionViewMode, TextureSources, ShaderRenderOptions } from './types.ts';

export type { TextureSources, ProgressionViewMode, ShaderRenderOptions };

export const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
`;

export const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

varying vec2 v_texCoord;

uniform sampler2D u_stage0;
uniform sampler2D u_stage1;
uniform sampler2D u_stage2;
uniform sampler2D u_mask1;
uniform sampler2D u_mask2;

uniform float u_progress;         // Normalized 0.0 to 1.0
uniform float u_has_mask1;        // 1.0 if mask1 provided, 0.0 otherwise
uniform float u_has_mask2;        // 1.0 if mask2 provided, 0.0 otherwise
uniform float u_view_mode;        // 0.0 = Standard RGB, 1.0 = Attention Heatmap, 2.0 = Difference Mask
uniform float u_split_enabled;    // 1.0 = active, 0.0 = inactive
uniform float u_split_position;   // 0.0 to 1.0 horizontal split curtain line

// 3-stop Bio-Agronomic Colormap (SPEC-UI-007):
// Stop 1: Deep Teal #0F766E = rgb(15, 118, 110) = vec3(0.0588, 0.4627, 0.4314)
// Stop 2: Warm Amber #F59E0B = rgb(245, 158, 11) = vec3(0.9608, 0.6196, 0.0431)
// Stop 3: Vivid Red #DC2626 = rgb(220, 38, 38) = vec3(0.8627, 0.1490, 0.1490)
vec3 getAttentionColormap(float w) {
    vec3 colLow = vec3(0.0588, 0.4627, 0.4314);
    vec3 colMid = vec3(0.9608, 0.6196, 0.0431);
    vec3 colHigh = vec3(0.8627, 0.1490, 0.1490);
    
    if (w < 0.35) {
        float f = clamp(w / 0.35, 0.0, 1.0);
        return mix(colLow, colMid, f);
    } else {
        float f = clamp((w - 0.35) / 0.65, 0.0, 1.0);
        return mix(colMid, colHigh, f);
    }
}

void main() {
    // Correct Y orientation for WebGL texture sampling
    vec2 uv = vec2(v_texCoord.x, 1.0 - v_texCoord.y);

    vec4 col0 = texture2D(u_stage0, uv);
    vec4 col1 = texture2D(u_stage1, uv);
    vec4 col2 = texture2D(u_stage2, uv);

    float m1 = 0.5;
    if (u_has_mask1 > 0.5) {
        m1 = texture2D(u_mask1, uv).r;
    }

    float m2 = 0.5;
    if (u_has_mask2 > 0.5) {
        m2 = texture2D(u_mask2, uv).r;
    }

    vec4 rgbColor;
    float currentMask;

    if (u_progress <= 0.5) {
        // Phase 1: 0.0 -> 0.5 (Stage 0 -> Stage 1)
        float t = u_progress / 0.5; // Normalized to 0.0 -> 1.0

        // Contrast-accentuated localized blend:
        // Areas with higher chlorosis mask values emerge earlier with organic contours
        float organicFactor = clamp((t - (1.0 - m1) * 0.35) / 0.65, 0.0, 1.0);
        float blendAlpha = mix(t, organicFactor, 0.65);

        rgbColor = mix(col0, col1, blendAlpha);
        // Continuous progression: if mask is missing, progress monotonically with u_progress
        currentMask = (u_has_mask1 > 0.5) ? (m1 * clamp(t * 1.5, 0.05, 1.0)) : u_progress;
    } else {
        // Phase 2: 0.5 -> 1.0 (Stage 1 -> Stage 2)
        float t = (u_progress - 0.5) / 0.5; // Normalized to 0.0 -> 1.0

        // High-pass necrotic edge reveal:
        // Necrotic cores and collapsed margins emerge organically
        float organicFactor = clamp((t - (1.0 - m2) * 0.40) / 0.60, 0.0, 1.0);
        float blendAlpha = mix(t, organicFactor, 0.70);

        rgbColor = mix(col1, col2, blendAlpha);
        // Continuous progression across midpoint: blend m1 to m2, or track u_progress monotonically
        currentMask = (u_has_mask2 > 0.5) ? mix(m1, m2, t) : u_progress;
    }

    // Determine output color based on u_view_mode
    // 0.0 = Standard RGB
    // 1.0 = Cross-Attention Heatmap
    // 2.0 = Difference Mask
    vec4 modeColor;
    if (u_view_mode > 1.5) {
        // Mode 2: Difference Mask (high-contrast monochrome mask preserving foliar silhouette/alpha)
        modeColor = vec4(vec3(currentMask), rgbColor.a);
    } else if (u_view_mode > 0.5) {
        // Mode 1: Cross-Attention Heatmap (Bio-Teal #0F766E -> Amber #F59E0B -> Red #DC2626)
        vec3 heatColor = getAttentionColormap(currentMask);
        // Blend heatmap over leaf surface preserving underlying structure and foliar veins
        float heatIntensity = clamp(currentMask * 0.75 + 0.20, 0.0, 0.90);
        modeColor = vec4(mix(rgbColor.rgb, heatColor, heatIntensity), rgbColor.a);
    } else {
        // Mode 0: Standard Photorealistic RGB
        modeColor = rgbColor;
    }

    // Apply Split Curtain Compare (if enabled)
    if (u_split_enabled > 0.5) {
        float splitDelta = uv.x - u_split_position;
        if (abs(splitDelta) < 0.002) {
            // Crisp divider line (white accent)
            gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
        } else if (splitDelta < 0.0) {
            // Left of divider: Stage 0 (Healthy baseline specimen)
            gl_FragColor = col0;
        } else {
            // Right of divider: Current progression state & view mode
            gl_FragColor = modeColor;
        }
    } else {
        gl_FragColor = modeColor;
    }
}
`;

/**
 * Analytical pure-function reference implementation of the 3-stop Bio-Agronomic Colormap.
 */
export function evaluateAttentionColormap(w: number): [number, number, number] {
  const clamped = Math.max(0.0, Math.min(1.0, w));
  const colLow: [number, number, number] = [0.0588, 0.4627, 0.4314];
  const colMid: [number, number, number] = [0.9608, 0.6196, 0.0431];
  const colHigh: [number, number, number] = [0.8627, 0.1490, 0.1490];

  if (clamped < 0.35) {
    const f = clamped / 0.35;
    return [
      colLow[0] + (colMid[0] - colLow[0]) * f,
      colLow[1] + (colMid[1] - colLow[1]) * f,
      colLow[2] + (colMid[2] - colLow[2]) * f,
    ];
  } else {
    const f = (clamped - 0.35) / 0.65;
    return [
      colMid[0] + (colHigh[0] - colMid[0]) * f,
      colMid[1] + (colHigh[1] - colMid[1]) * f,
      colMid[2] + (colHigh[2] - colMid[2]) * f,
    ];
  }
}

interface ShaderLocations {
  a_position: number;
  a_texCoord: number;
  u_stage0: WebGLUniformLocation | null;
  u_stage1: WebGLUniformLocation | null;
  u_stage2: WebGLUniformLocation | null;
  u_mask1: WebGLUniformLocation | null;
  u_mask2: WebGLUniformLocation | null;
  u_has_mask1: WebGLUniformLocation | null;
  u_has_mask2: WebGLUniformLocation | null;
  u_progress: WebGLUniformLocation | null;
  u_view_mode: WebGLUniformLocation | null;
  u_split_enabled: WebGLUniformLocation | null;
  u_split_position: WebGLUniformLocation | null;
}

export class ProgressionShaderRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private isWebGL = false;
  private isDisposed = false;

  private program: WebGLProgram | null = null;
  private locations: ShaderLocations | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;

  // WebGL Textures
  private texStage0: WebGLTexture | null = null;
  private texStage1: WebGLTexture | null = null;
  private texStage2: WebGLTexture | null = null;
  private texMask1: WebGLTexture | null = null;
  private texMask2: WebGLTexture | null = null;

  // 2D Canvas Fallback Image Cache
  private imgStage0: HTMLImageElement | null = null;
  private imgStage1: HTMLImageElement | null = null;
  private imgStage2: HTMLImageElement | null = null;

  private currentProgress = 0.0;
  private viewMode: ProgressionViewMode = 'rgb';
  private viewModeNum = 0.0;
  private splitEnabled = false;
  private splitPosition = 0.5;

  private isLoaded = false;
  private animFrameId: number | null = null;
  private currentLoadId = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    if (this.canvas.width <= 0 || this.canvas.height <= 0) {
      this.canvas.width = 800;
      this.canvas.height = 800;
    }
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    this.initContext();
  }

  /**
   * Returns true if WebGL pipeline initialized and active.
   */
  public isAvailable(): boolean {
    return this.isWebGL && !this.isDisposed && !!this.program && !this.gl?.isContextLost();
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.isWebGL = false;
    this.program = null;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  };

  private initContext() {
    try {
      const gl =
        this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true }) ||
        (this.canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);

      if (gl && !gl.isContextLost()) {
        this.gl = gl;
        this.isWebGL = true;
        this.initWebGLPipeline();
        if (this.isWebGL) return;
      }
    } catch {
      // Fallback to 2D
    }

    this.isWebGL = false;
    try {
      this.ctx2d = this.canvas.getContext('2d');
    } catch {
      this.ctx2d = null;
    }
  }

  private initWebGLPipeline() {
    if (!this.gl || this.gl.isContextLost()) {
      this.isWebGL = false;
      return;
    }
    const gl = this.gl;

    const vertShader = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fragShader = this.compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);

    if (!vertShader || !fragShader) {
      console.warn('[ProgressionShaderRenderer] Shader compilation failed, WebGL pipeline inactive');
      this.isWebGL = false;
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      this.isWebGL = false;
      return;
    }

    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('[ProgressionShaderRenderer] Shader link failed:', gl.getProgramInfoLog(program));
      this.isWebGL = false;
      return;
    }

    // Detach and clean up individual shaders post-linking to free driver memory
    gl.detachShader(program, vertShader);
    gl.detachShader(program, fragShader);
    gl.deleteShader(vertShader);
    gl.deleteShader(fragShader);

    this.program = program;

    // Cache hot uniform and attribute locations to avoid string hashing on 60 FPS scrub
    this.locations = {
      a_position: gl.getAttribLocation(program, 'a_position'),
      a_texCoord: gl.getAttribLocation(program, 'a_texCoord'),
      u_stage0: gl.getUniformLocation(program, 'u_stage0'),
      u_stage1: gl.getUniformLocation(program, 'u_stage1'),
      u_stage2: gl.getUniformLocation(program, 'u_stage2'),
      u_mask1: gl.getUniformLocation(program, 'u_mask1'),
      u_mask2: gl.getUniformLocation(program, 'u_mask2'),
      u_has_mask1: gl.getUniformLocation(program, 'u_has_mask1'),
      u_has_mask2: gl.getUniformLocation(program, 'u_has_mask2'),
      u_progress: gl.getUniformLocation(program, 'u_progress'),
      u_view_mode: gl.getUniformLocation(program, 'u_view_mode'),
      u_split_enabled: gl.getUniformLocation(program, 'u_split_enabled'),
      u_split_position: gl.getUniformLocation(program, 'u_split_position'),
    };

    // Bind immutable texture sampler units once during pipeline initialization
    gl.useProgram(program);
    if (this.locations.u_stage0) gl.uniform1i(this.locations.u_stage0, 0);
    if (this.locations.u_stage1) gl.uniform1i(this.locations.u_stage1, 1);
    if (this.locations.u_stage2) gl.uniform1i(this.locations.u_stage2, 2);
    if (this.locations.u_mask1) gl.uniform1i(this.locations.u_mask1, 3);
    if (this.locations.u_mask2) gl.uniform1i(this.locations.u_mask2, 4);

    // Full screen quad geometry
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const texCoords = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);

    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    if (!this.gl || this.gl.isContextLost()) return null;
    const shader = this.gl.createShader(type);
    if (!shader) return null;

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader);
      if (info) {
        console.error('[Shader Error]:', info);
      }
      this.gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  /**
   * Loads all required images and initializes textures concurrently with race-condition cancellation.
   */
  public async loadTextures(sources: TextureSources): Promise<void> {
    const loadId = ++this.currentLoadId;
    this.isLoaded = false;

    const [img0, img1, img2, m1, m2] = await Promise.all([
      this.loadImage(sources.stage0),
      this.loadImage(sources.stage1),
      this.loadImage(sources.stage2),
      sources.mask1 ? this.loadImage(sources.mask1) : Promise.resolve(null),
      sources.mask2 ? this.loadImage(sources.mask2) : Promise.resolve(null),
    ]);

    // Discard stale out-of-order responses or disposed instance
    if (this.isDisposed || loadId !== this.currentLoadId) {
      return;
    }

    this.imgStage0 = img0;
    this.imgStage1 = img1;
    this.imgStage2 = img2;

    if (this.isWebGL && this.gl && !this.gl.isContextLost()) {
      const gl = this.gl;
      if (this.texStage0) gl.deleteTexture(this.texStage0);
      if (this.texStage1) gl.deleteTexture(this.texStage1);
      if (this.texStage2) gl.deleteTexture(this.texStage2);
      if (this.texMask1) gl.deleteTexture(this.texMask1);
      if (this.texMask2) gl.deleteTexture(this.texMask2);

      this.texStage0 = this.createGLTexture(gl, img0);
      this.texStage1 = this.createGLTexture(gl, img1);
      this.texStage2 = this.createGLTexture(gl, img2);
      this.texMask1 = m1 ? this.createGLTexture(gl, m1) : null;
      this.texMask2 = m2 ? this.createGLTexture(gl, m2) : null;
    }

    this.isLoaded = true;
    this.render(this.currentProgress);
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error(`Failed to load leaf image at ${url}: ${e}`));
      img.src = url;
    });
  }

  private createGLTexture(gl: WebGLRenderingContext, img: HTMLImageElement): WebGLTexture | null {
    const texture = gl.createTexture();
    if (!texture) return null;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

    // Standard clamping for 800x800 textures (non-POT safe)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    return texture;
  }

  /**
   * Sets unified rendering options (viewMode, splitEnabled, splitPosition).
   */
  public setOptions(options: ShaderRenderOptions): void {
    if (options.viewMode !== undefined) {
      this.setViewMode(options.viewMode);
    }
    if (options.splitEnabled !== undefined || options.splitPosition !== undefined) {
      this.setSplitCompare(
        options.splitEnabled ?? this.splitEnabled,
        options.splitPosition ?? this.splitPosition
      );
    }
  }

  /**
   * Sets the active view mode (RGB, Cross-Attention Heatmap, Difference Mask).
   */
  public setViewMode(mode: ProgressionViewMode | number): void {
    if (typeof mode === 'number') {
      this.viewModeNum = mode;
      if (mode >= 1.5) {
        this.viewMode = 'mask';
      } else if (mode >= 0.5) {
        this.viewMode = 'attention';
      } else {
        this.viewMode = 'rgb';
      }
    } else {
      this.viewMode = mode;
      switch (mode) {
        case 'attention':
          this.viewModeNum = 1.0;
          break;
        case 'mask':
          this.viewModeNum = 2.0;
          break;
        case 'rgb':
        default:
          this.viewModeNum = 0.0;
          break;
      }
    }
    this.render(this.currentProgress);
  }

  /**
   * Returns current active view mode.
   */
  public getViewMode(): ProgressionViewMode {
    return this.viewMode;
  }

  /**
   * Configures split-screen swipe comparison (Healthy baseline vs. Predicted state).
   */
  public setSplitCompare(enabled: boolean, position = 0.5): void {
    this.splitEnabled = enabled;
    this.splitPosition = Math.max(0.0, Math.min(1.0, position));
    this.render(this.currentProgress);
  }

  /**
   * Returns current split comparison status.
   */
  public getSplitCompare(): {
    enabled: boolean;
    position: number;
    splitEnabled: boolean;
    splitPosition: number;
  } {
    return {
      enabled: this.splitEnabled,
      position: this.splitPosition,
      splitEnabled: this.splitEnabled,
      splitPosition: this.splitPosition,
    };
  }

  /**
   * Schedules a frame render via requestAnimationFrame for 60 FPS performance.
   * progress: normalized number between 0.0 (Stage 0) and 1.0 (Stage 2).
   */
  public render(progress: number) {
    this.currentProgress = Math.max(0.0, Math.min(1.0, progress));

    if (!this.isLoaded || this.isDisposed) return;

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }

    this.animFrameId = requestAnimationFrame(() => {
      this.animFrameId = null;
      if (this.isWebGL) {
        this.renderWebGL();
      } else {
        this.render2DFallback();
      }
    });
  }

  private renderWebGL() {
    if (!this.gl || !this.program || !this.locations || this.gl.isContextLost()) return;
    const gl = this.gl;
    const locs = this.locations;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);

    // Bind Attributes using cached locations
    gl.enableVertexAttribArray(locs.a_position);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.vertexAttribPointer(locs.a_position, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(locs.a_texCoord);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.vertexAttribPointer(locs.a_texCoord, 2, gl.FLOAT, false, 0, 0);

    // Bind Textures to Units 0 - 4 (sampler uniforms already assigned during init)
    if (this.texStage0) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texStage0);
    }
    if (this.texStage1) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.texStage1);
    }
    if (this.texStage2) {
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.texStage2);
    }
    if (this.texMask1 && locs.u_has_mask1) {
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, this.texMask1);
      gl.uniform1f(locs.u_has_mask1, 1.0);
    } else if (locs.u_has_mask1) {
      gl.uniform1f(locs.u_has_mask1, 0.0);
    }
    if (this.texMask2 && locs.u_has_mask2) {
      gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D, this.texMask2);
      gl.uniform1f(locs.u_has_mask2, 1.0);
    } else if (locs.u_has_mask2) {
      gl.uniform1f(locs.u_has_mask2, 0.0);
    }

    // Set Progression & View Mode Uniforms
    if (locs.u_progress) {
      gl.uniform1f(locs.u_progress, this.currentProgress);
    }
    if (locs.u_view_mode) {
      gl.uniform1f(locs.u_view_mode, this.viewModeNum);
    }
    if (locs.u_split_enabled) {
      gl.uniform1f(locs.u_split_enabled, this.splitEnabled ? 1.0 : 0.0);
    }
    if (locs.u_split_position) {
      gl.uniform1f(locs.u_split_position, this.splitPosition);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private render2DFallback() {
    if (!this.ctx2d || !this.imgStage0 || !this.imgStage1 || !this.imgStage2) return;
    const ctx = this.ctx2d;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    const drawProgression = (targetCtx: CanvasRenderingContext2D, width: number, height: number) => {
      targetCtx.save();
      // Apply mask filter directly to source renders rather than copying canvas onto itself
      if (this.viewMode === 'mask') {
        targetCtx.filter = 'grayscale(100%) contrast(180%)';
      }

      if (this.currentProgress <= 0.5) {
        const t = this.currentProgress / 0.5;
        targetCtx.globalAlpha = 1.0;
        targetCtx.drawImage(this.imgStage0!, 0, 0, width, height);
        targetCtx.globalAlpha = t;
        targetCtx.drawImage(this.imgStage1!, 0, 0, width, height);
      } else {
        const t = (this.currentProgress - 0.5) / 0.5;
        targetCtx.globalAlpha = 1.0;
        targetCtx.drawImage(this.imgStage1!, 0, 0, width, height);
        targetCtx.globalAlpha = t;
        targetCtx.drawImage(this.imgStage2!, 0, 0, width, height);
      }
      targetCtx.restore();

      // 2D Attention Heatmap Tint Overlay
      if (this.viewMode === 'attention') {
        targetCtx.save();
        targetCtx.fillStyle = 'rgba(245, 158, 11, 0.35)';
        targetCtx.fillRect(0, 0, width, height);
        targetCtx.restore();
      }
    };

    if (this.splitEnabled) {
      const splitX = Math.round(w * this.splitPosition);

      // Draw Stage 0 Healthy on left
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, splitX, h);
      ctx.clip();
      ctx.drawImage(this.imgStage0, 0, 0, w, h);
      ctx.restore();

      // Draw active progression state on right
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, w - splitX, h);
      ctx.clip();
      drawProgression(ctx, w, h);
      ctx.restore();

      // Divider Line
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, h);
      ctx.stroke();
    } else {
      drawProgression(ctx, w, h);
    }
  }

  public resize(width: number, height: number, dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1) {
    const w = Math.floor(width * dpr);
    const h = Math.floor(height * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    this.render(this.currentProgress);
  }

  /**
   * Cleans up GPU buffers, textures, context loss, and event loops.
   */
  public dispose() {
    this.isDisposed = true;
    this.currentLoadId++;

    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.gl && !this.gl.isContextLost()) {
      const gl = this.gl;
      if (this.texStage0) gl.deleteTexture(this.texStage0);
      if (this.texStage1) gl.deleteTexture(this.texStage1);
      if (this.texStage2) gl.deleteTexture(this.texStage2);
      if (this.texMask1) gl.deleteTexture(this.texMask1);
      if (this.texMask2) gl.deleteTexture(this.texMask2);
      if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
      if (this.texCoordBuffer) gl.deleteBuffer(this.texCoordBuffer);
      if (this.program) gl.deleteProgram(this.program);
    }
    this.gl = null;

    this.locations = null;
    this.program = null;
    this.positionBuffer = null;
    this.texCoordBuffer = null;
    this.texStage0 = null;
    this.texStage1 = null;
    this.texStage2 = null;
    this.texMask1 = null;
    this.texMask2 = null;

    this.imgStage0 = null;
    this.imgStage1 = null;
    this.imgStage2 = null;
    this.isLoaded = false;
  }
}
