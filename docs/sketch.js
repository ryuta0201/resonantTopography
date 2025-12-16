/**
 * v0.3 The Resonant Topography (Scalable Architecture)
 * * - Spatial Hash (Uniform Grid) for O(N) neighbor lookup
 * - Separation of Physics (Update) and Rendering
 * - Continuous State Blending (Fog <-> Net <-> Fluid)
 */

// --- CONFIGURATION ---
const CONFIG = {
  // System
  nodeCount: 200,          // ノード数 (Grid実装により増量可)
  gridCellSize: 120,       // 空間分割のセルサイズ (connectionDist以上に設定)
  
  // Physics: FOG
  fog: {
    maxSpeed: 0.5,
    noiseScale: 0.005,
    noiseStrength: 0.5
  },

  // Physics: NET (Constellation)
  net: {
    connectionDist: 100,   // 線をつなぐ距離
    attractForce: 0.008,   // 引き合う力 (構造化)
    repelForce: 0.15,      // 反発する力 (島化・潰れ防止)
    repelRadius: 40,       // 反発が発生する距離
    drag: 0.90             // 減衰 (構造を安定させる)
  },

  // Physics: FLUID (Cenote)
  fluid: {
    maxSpeed: 4.0,
    centerGravity: 0.02,   // 中心への引力
    vortexStrength: 0.08,  // 回転力
    flowNoise: 0.2,        // 流体の乱れ
    drag: 0.96             // 滑らかな動き
  },

  // Visuals
  colors: {
    base: [100, 200, 255], // R, G, B
  },
  transitionSpeed: 0.02    // 状態遷移の滑らかさ
};

// Visual sizes (tweakable, will be scaled for mobile)
CONFIG.visuals.nodeBaseSize = 8;        // 通常のノードサイズ
CONFIG.visuals.nodeFluidMaxSize = 24;  // Fluid時の最大サイズ

const IS_MOBILE =
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  window.innerWidth < 768;

// --- GLOBAL VARIABLES ---
let nodes = [];
let grid;
let sceneManager;
let glowTexture;
let fluidProfile = {
  gravitySign: 1,      // +1: 吸引, -1: 斥力
  gravityScale: 10.0,   // 強さの倍率
};

// Initial velocity scale (can be boosted on mobile)
let INITIAL_VEL_SCALE = 1.0;

function setup() {
  createCanvas(windowWidth, windowHeight);

  // Mobile adjustments: fewer nodes, bigger visuals, stronger forces/speeds
  if (IS_MOBILE) {
    console.log("⚠️ Mobile detected — applying mobile config");
    // Reduce node count for performance on mobile
    CONFIG.nodeCount = 50;

    // Increase visible particle sizes for touch targets
    CONFIG.visuals.nodeBaseSize *= 1.8;
    CONFIG.visuals.nodeFluidMaxSize *= 1.8;

    // Boost physics/velocity (1.5〜2倍の範囲; using 1.8 as a balanced default)
    const scale = 1.8;
    CONFIG.fog.maxSpeed *= scale;
    CONFIG.fog.noiseStrength *= scale;

    CONFIG.net.attractForce *= scale;
    CONFIG.net.repelForce *= scale;
    CONFIG.net.repelRadius *= scale;

    CONFIG.fluid.maxSpeed *= scale;
    CONFIG.fluid.centerGravity *= scale;
    CONFIG.fluid.vortexStrength *= scale;
    CONFIG.fluid.flowNoise *= scale;

    // Make initial velocities a bit stronger on mobile
    INITIAL_VEL_SCALE = scale;
  } else {
    INITIAL_VEL_SCALE = 1.0;
  }
  
  // 1. Initialize Managers
  sceneManager = new SceneManager();
  grid = new UniformGrid(width, height, CONFIG.gridCellSize);
  
  // 2. Precompute Assets
  glowTexture = createGlowTexture(32);
  
  // 3. Spawn Nodes
  for (let i = 0; i < CONFIG.nodeCount; i++) {
    nodes.push(new Node(random(width), random(height), i));
  }
}

function draw() {
  // 1. Update State (Time & Weights)
  sceneManager.update();

  // 2. Physics Step
  // Clear & Rebuild Grid for efficient neighbor lookup
  grid.clear();
  for (let node of nodes) grid.insert(node);

  // Apply Forces & Integration
  let weights = sceneManager.getWeights();
  for (let node of nodes) {
    node.resetForces();
    node.applyBehaviors(nodes, grid, weights);
    node.updatePhysics(weights);
  }

  // 3. Render Step
  // Background with trails based on Fluid weight
  let bgAlpha = lerp(30, 5, weights.fluid); 
  background(10, 15, 25, bgAlpha);

  blendMode(ADD);
  
  // Render Lines & Particles
  // (Pass weights to render function to blend styles)
  renderScene(nodes, grid, weights);
  
  blendMode(BLEND);
  
  // 4. UI
  sceneManager.displayDebug();
}

function mousePressed() {
  sceneManager.cyclePhase();
}

function touchStarted() {
  sceneManager.cyclePhase();
  return false; // スクロール防止
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  grid = new UniformGrid(width, height, CONFIG.gridCellSize);
}

// ==========================================
// CLASS: SCENE MANAGER (State Machine)
// ==========================================
class SceneManager {
  constructor() {
    this.targetPhase = 0; // 0:Fog, 1:Net, 2:Fluid
    this.currentT = 0;    // Continuous time 0.0 -> 2.0
    this.weights = { fog: 1, net: 0, fluid: 0 };
    this.dir = 1;         // Direction of transition
    this.prevPhase = 0; 
  }

  cyclePhase() {
    // Logic: 0 -> 1 -> 2 -> 1 -> 0 ...
    if (this.targetPhase === 0) this.dir = 1;
    if (this.targetPhase === 2) this.dir = -1;
    
    this.targetPhase += this.dir;
    this.targetPhase = constrain(this.targetPhase, 0, 2);
    
    this.onPhaseChanged(this.prevPhase, this.targetPhase);
  }

  onPhaseChanged(prev, next) {
    // ★ Fluid に入る(1→2) or 出る(2→1) “瞬間” だけ
    const enteringFluid = (prev === 1 && next === 2);
    const leavingFluid  = (prev === 2 && next === 1);

    if (enteringFluid || leavingFluid) {
      randomizeFluidProfile();
    }
  }

  update() {
    // Smooth transition
    this.currentT = lerp(this.currentT, this.targetPhase, CONFIG.transitionSpeed);
    
    // Calculate weights based on T
    // Fog: 1.0 at T=0, 0.0 at T=1
    this.weights.fog = constrain(1.0 - this.currentT, 0, 1);
    
    // Net: 0.0 at T=0, 1.0 at T=1, 0.0 at T=2
    this.weights.net = 1.0 - abs(this.currentT - 1.0);
    this.weights.net = constrain(this.weights.net, 0, 1);
    
    // Fluid: 0.0 at T=1, 1.0 at T=2
    this.weights.fluid = constrain(this.currentT - 1.0, 0, 1);
  }

  getWeights() {
    return this.weights;
  }

  displayDebug() {
    fill(255); noStroke(); textAlign(LEFT, TOP); textSize(12);
    let phaseName = ["FOG (Uncertainty)", "NET (Constellation)", "FLUID (Cenote)"];
    let idx = round(this.targetPhase);
    text(`PHASE: ${phaseName[idx]}`, 20, 20);
    text(`Weights: Fog(${this.weights.fog.toFixed(2)}) Net(${this.weights.net.toFixed(2)}) Fluid(${this.weights.fluid.toFixed(2)})`, 20, 40);
    text(`FPS: ${frameRate().toFixed(0)} / Nodes: ${nodes.length}`, 20, 60);
  }
}

// ==========================================
// CLASS: SPATIAL HASH (Uniform Grid)
// ==========================================
class UniformGrid {
  constructor(w, h, size) {
    this.cellSize = size;
    this.cols = ceil(w / size);
    this.rows = ceil(h / size);
    this.cells = new Array(this.cols * this.rows).fill(null).map(() => []);
  }

  clear() {
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i].length = 0; // 高速な配列クリア
    }
  }

  insert(node) {
    let col = floor(node.pos.x / this.cellSize);
    let row = floor(node.pos.y / this.cellSize);
    // 画面外ガード
    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      this.cells[col + row * this.cols].push(node);
    }
  }

  // 近傍セル内のノードリストを返す
  query(node) {
    let col = floor(node.pos.x / this.cellSize);
    let row = floor(node.pos.y / this.cellSize);
    let results = [];

    // 隣接9セルをチェック
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        let c = col + i;
        let r = row + j;
        if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
          let cellNodes = this.cells[c + r * this.cols];
          for (let n of cellNodes) {
            results.push(n);
          }
        }
      }
    }
    return results;
  }
}

// ==========================================
// CLASS: NODE (Data & Physics)
// ==========================================
class Node {
  constructor(x, y, id) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(0.5 * INITIAL_VEL_SCALE);
    this.acc = createVector(0, 0);
    this.mass = random(0.8, 1.2);
    this.id = id;
    this.dataSlot = null; // 将来の言語データ用
  }

  resetForces() {
    this.acc.mult(0);
  }

  applyBehaviors(allNodes, grid, w) {
    // 1. FOG Forces (Noise)
    if (w.fog > 0.01) {
      let noiseVal = noise(this.pos.x * CONFIG.fog.noiseScale, this.pos.y * CONFIG.fog.noiseScale, frameCount * 0.005);
      let angle = noiseVal * TWO_PI * 4;
      let fogForce = p5.Vector.fromAngle(angle).mult(CONFIG.fog.noiseStrength * w.fog);
      this.acc.add(fogForce);
    }

    // 2. NET Forces (Local Interaction via Grid)
    if (w.net > 0.01 || w.fluid > 0.01) { // Fluidでも近傍反発は少し残すと綺麗
      // Gridを使って近傍のみ取得 (O(N) order)
      let neighbors = grid.query(this);
      
      for (let other of neighbors) {
        if (other === this) continue;
        
        let d = p5.Vector.dist(this.pos, other.pos);
        
        // 距離チェック
        if (d > 0 && d < CONFIG.net.connectionDist) {
          let dir = p5.Vector.sub(other.pos, this.pos).normalize();

          // A. Attraction (引力) - Netのみ
          // Fluid時は引力を切る（溶ける表現）
          if (w.net > 0.01) {
            let attractStr = map(d, 0, CONFIG.net.connectionDist, 1, 0);
            this.acc.add(dir.copy().mult(attractStr * CONFIG.net.attractForce * w.net));
          }

          // B. Separation (反発) - Net & Fluid (島化・潰れ防止)
          // 近すぎるときだけ強く反発
          if (d < CONFIG.net.repelRadius) {
            let repelStr = map(d, 0, CONFIG.net.repelRadius, 1, 0);
            // Fluid時は少し反発を弱めて「融合」させる
            let fluidFactor = (1.0 - w.fluid * 0.5); 
            this.acc.add(dir.copy().mult(-1 * repelStr * CONFIG.net.repelForce * w.net * fluidFactor));
          }
        }
      }
    }

    // 3. FLUID Forces (Global Vortex)
    if (w.fluid > 0.01) {
      let center = createVector(width/2, height/2);
      let dirToCenter = p5.Vector.sub(center, this.pos).normalize();
      
      // 中心への引力
      this.acc.add(
        dirToCenter.copy().mult(
          CONFIG.fluid.centerGravity * 
          w.fluid *
          fluidProfile.gravitySign *
          fluidProfile.gravityScale
        )
      );
      
      // 回転力 (Spiral)
      let spiralDir = createVector(-dirToCenter.y, dirToCenter.x);
      this.acc.add(spiralDir.mult(CONFIG.fluid.vortexStrength * w.fluid));
      
      // カオス (Flow Noise)
      let fluidNoise = noise(this.pos.x * 0.01, this.pos.y * 0.01, frameCount * 0.01);
      let noiseDir = p5.Vector.fromAngle(fluidNoise * TWO_PI).mult(CONFIG.fluid.flowNoise * w.fluid);
      this.acc.add(noiseDir);
    }
  }

  updatePhysics(w) {
    // 状態に応じた摩擦(Drag)と速度制限のブレンド
    let drag = 1.0;
    let maxSpeed = 1.0;

    // 単純な lerp ではなく、優勢なモードの影響を受ける
    if (w.fog > 0.5) { maxSpeed = CONFIG.fog.maxSpeed; }
    
    // Net: 強い摩擦で構造を安定させる
    if (w.net > 0.5) { 
      drag = CONFIG.net.drag; 
      maxSpeed = 2.0; 
    }
    
    // Fluid: 摩擦を減らして滑らかに流す
    if (w.fluid > 0.5) { 
      drag = CONFIG.fluid.drag; 
      maxSpeed = CONFIG.fluid.maxSpeed; 
    }

    this.vel.add(this.acc);
    this.vel.mult(drag);
    this.vel.limit(maxSpeed);
    this.pos.add(this.vel);
    
    this.wrapEdges();
  }

  wrapEdges() {
    if (this.pos.x < 0) this.pos.x = width;
    if (this.pos.x > width) this.pos.x = 0;
    if (this.pos.y < 0) this.pos.y = height;
    if (this.pos.y > height) this.pos.y = 0;
  }
}

// ==========================================
// RENDER FUNCTION (Visuals Only)
// ==========================================
function renderScene(nodes, grid, w) {
  // 1. Draw Connections (NET Phase)
  if (w.net > 0.01) {
    strokeWeight(1);
    // 高速化のため、描画も Grid を使用する
    // ただし描画は重複しても問題ないので、全ノード走査でOKだが
    // Grid近傍のみチェックすることで描画負荷を下げる
    
    for (let node of nodes) {
      let neighbors = grid.query(node);
      for (let other of neighbors) {
        if (node.id > other.id) continue; // 重複描画防止 (ID大小比較)
        
        let d = dist(node.pos.x, node.pos.y, other.pos.x, other.pos.y);
        
        // Fluidへ移行するとき、距離閾値を小さくして「溶ける」表現にする
        let dynamicDist = CONFIG.net.connectionDist * (1.0 - w.fluid * 0.8);

        if (d < dynamicDist) {
          let alpha = map(d, 0, dynamicDist, 150, 0);
          // w.net で全体の透明度制御
          stroke(CONFIG.colors.base[0], CONFIG.colors.base[1], CONFIG.colors.base[2], alpha * w.net);
          line(node.pos.x, node.pos.y, other.pos.x, other.pos.y);
        }
      }
    }
  }

  // 2. Draw Particles
  noStroke();
  imageMode(CENTER);
  
  for (let node of nodes) {
    // Size & Alpha blend based on state
    // Fog: small, dim
    // Net: sharp, bright
    // Fluid: large, soft (Metaball effect via additive blend)
    
    // Use configurable sizes (can be increased for mobile in setup)
    let size = CONFIG.visuals.nodeBaseSize;
    let alpha = 150;
    
    if (w.fluid > 0.01) {
      size = lerp(CONFIG.visuals.nodeBaseSize, CONFIG.visuals.nodeFluidMaxSize, w.fluid); // Fluidで巨大化
      alpha = lerp(150, 80, w.fluid); // 透明度を下げて重ねる
    }
    
    tint(CONFIG.colors.base[0], CONFIG.colors.base[1], CONFIG.colors.base[2], alpha);
    image(glowTexture, node.pos.x, node.pos.y, size, size);
  }
}

// Helper: Glow Texture Generation
function createGlowTexture(s) {
  let img = createImage(s, s);
  img.loadPixels();
  for (let x = 0; x < s; x++) {
    for (let y = 0; y < s; y++) {
      let d = dist(x, y, s/2, s/2);
      let c = map(d, 0, s/2, 255, 0);
      let idx = (x + y * s) * 4;
      img.pixels[idx] = 255; 
      img.pixels[idx+1] = 255; 
      img.pixels[idx+2] = 255;
      img.pixels[idx+3] = constrain(c, 0, 255);
    }
  }
  img.updatePixels();
  return img;
}

// Utility
function randomizeFluidProfile() {
  if (random() < 0.1) {
    fluidProfile.gravitySign = -1;
    fluidProfile.gravityScale = random(2, 8);
    console.log("🔥 FLUID PROFILE: STRONG REPULSION", fluidProfile);
  } else {
    fluidProfile.gravitySign = 1;
    fluidProfile.gravityScale = random(0.7, 1.3);
    console.log("🌀 FLUID PROFILE: ATTRACT", fluidProfile);
  }
}