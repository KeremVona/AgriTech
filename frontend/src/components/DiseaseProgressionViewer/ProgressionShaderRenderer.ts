/**
 * Core WebGL & Canvas 2D Blending Engine for Leaf Disease Progression (TODO-108).
 * Executes a two-phase fragment shader blend:
 * - Slider 0 -> 50%: Cross-dissolve Stage 0 (Healthy) to Stage 1 (Early) with localized chlorosis masking.
 * - Slider 51 -> 100%: Cross-dissolve Stage 1 to Stage 2 (Severe) with high-pass necrotic reveal.
 * Includes graceful HTML5 2D Canvas fallback and full context disposal for zero memory leaks.
 */

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

varying vec2 v_texCoord;

uniform sampler2D u_stage0;
uniform sampler2D u_stage1;
uniform sampler2D u_stage2;
uniform sampler2D u_mask1;
uniform sampler2D u_mask2;

uniform float u_progress;      // Normalized 0.0 to 1.0
uniform float u_has_mask1;     // 1.0 if mask1 provided, 0.0 otherwise
uniform float u_has_mask2;     // 1.0 if mask2 provided, 0.0 otherwise

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

    vec4 finalColor;

    if (u_progress <= 0.5) {
        // Phase 1: 0.0 -> 0.5 (Stage 0 -> Stage 1)
        float t = u_progress / 0.5; // Normalized to 0.0 -> 1.0

        // Contrast-accentuated localized blend:
        // Areas with higher chlorosis mask values emerge earlier with organic contours
        float organicFactor = clamp((t - (1.0 - m1) * 0.35) / 0.65, 0.0, 1.0);
        float blendAlpha = mix(t, organicFactor, 0.65);

        finalColor = mix(col0, col1, blendAlpha);
    } else {
        // Phase 2: 0.5 -> 1.0 (Stage 1 -> Stage 2)
        float t = (u_progress - 0.5) / 0.5; // Normalized to 0.0 -> 1.0

        // High-pass necrotic edge reveal:
        // Necrotic cores and collapsed margins emerge organically
        float organicFactor = clamp((t - (1.0 - m2) * 0.40) / 0.60, 0.0, 1.0);
        float blendAlpha = mix(t, organicFactor, 0.70);

        finalColor = mix(col1, col2, blendAlpha);
    }

    gl_FragColor = finalColor;
}
`;

export interface TextureSources {
  stage0: string;
  stage1: string;
  stage2: string;
  mask1?: string | null;
  mask2?: string | null;
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
    return this.isWebGL && !!this.program && !this.gl?.isContextLost();
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
      // Fallback
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
    };

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

  private createGLTexture(gl: WebGLRenderingContext, img: HTMLImageElement): WebGLTexture {
    const texture = gl.createTexture()!;
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

    // Bind Textures to Units 0 - 4
    if (this.texStage0 && locs.u_stage0) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texStage0);
      gl.uniform1i(locs.u_stage0, 0);
    }
    if (this.texStage1 && locs.u_stage1) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.texStage1);
      gl.uniform1i(locs.u_stage1, 1);
    }
    if (this.texStage2 && locs.u_stage2) {
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.texStage2);
      gl.uniform1i(locs.u_stage2, 2);
    }
    if (this.texMask1 && locs.u_mask1) {
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, this.texMask1);
      gl.uniform1i(locs.u_mask1, 3);
      gl.uniform1f(locs.u_has_mask1, 1.0);
    } else {
      gl.uniform1f(locs.u_has_mask1, 0.0);
    }
    if (this.texMask2 && locs.u_mask2) {
      gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D, this.texMask2);
      gl.uniform1i(locs.u_mask2, 4);
      gl.uniform1f(locs.u_has_mask2, 1.0);
    } else {
      gl.uniform1f(locs.u_has_mask2, 0.0);
    }

    // Set Progress Uniform
    gl.uniform1f(locs.u_progress, this.currentProgress);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private render2DFallback() {
    if (!this.ctx2d || !this.imgStage0 || !this.imgStage1 || !this.imgStage2) return;
    const ctx = this.ctx2d;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (this.currentProgress <= 0.5) {
      const t = this.currentProgress / 0.5;
      ctx.globalAlpha = 1.0;
      ctx.drawImage(this.imgStage0, 0, 0, w, h);
      ctx.globalAlpha = t;
      ctx.drawImage(this.imgStage1, 0, 0, w, h);
    } else {
      const t = (this.currentProgress - 0.5) / 0.5;
      ctx.globalAlpha = 1.0;
      ctx.drawImage(this.imgStage1, 0, 0, w, h);
      ctx.globalAlpha = t;
      ctx.drawImage(this.imgStage2, 0, 0, w, h);
    }

    ctx.globalAlpha = 1.0;
  }

  public resize(width: number, height: number, dpr = window.devicePixelRatio || 1) {
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
      // Note: Do NOT call loseExt?.loseContext() here. In React 19 / StrictMode,
      // unmount is immediately followed by remount on the same canvas DOM node.
      // Calling loseContext() permanently kills the context for the remounted component.
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
