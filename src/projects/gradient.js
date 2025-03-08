// WebGPU グラデーションデモ（Compute Shader使用）
import { 
  initWebGPU, 
  loadShader, 
  createShaderModule, 
  setupResizeObserver, 
  displayError, 
  beginRenderPass, 
  submitCommands,
  setupAnimationLoop
} from './webgpu-utils.js';

// グローバル変数（リソース管理用）
let timeBuffer;
let computeShaderModule;
let computePipeline;
let bindGroupLayout;
let outputTexture;
let sampler;
let renderPipeline;
let renderBindGroupLayout;

// 頂点シェーダコード
const vertexShaderCode = `
@vertex
fn main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, 1.0)
  );
  
  return vec4f(pos[vertexIndex], 0.0, 1.0);
}
`;

// Compute Shaderの実行とレンダリング
async function runComputeShader(device, context, canvas, currentTime = 0) {
  const format = context.getCurrentTexture().format;
  
  // 初期化（初回のみ実行）
  if (!computeShaderModule) {
    await initializeResources(device, format, canvas);
  }

  // キャンバスサイズが変更された場合、出力テクスチャを再作成
  if (outputTexture.width !== canvas.width || outputTexture.height !== canvas.height) {
    updateCanvasResources(device, format, canvas);
  }

  // 時間値を更新
  const timeData = new Float32Array([currentTime]);
  device.queue.writeBuffer(timeBuffer, 0, timeData);

  // コンピュートシェーダの実行とレンダリング
  executeComputeAndRender(device, context);

  return outputTexture;
}

// リソースの初期化
async function initializeResources(device, format, canvas) {
  // コンピュートシェーダの読み込み
  const computeShaderCode = await loadShader('/shaders/gradient.comp.wgsl');
  computeShaderModule = createShaderModule(device, computeShaderCode);
  
  // フラグメントシェーダのコード（キャンバスサイズを動的に設定）
  const fragmentShaderCode = `
  @group(0) @binding(0) var textureSampler: sampler;
  @group(0) @binding(1) var textureData: texture_2d<f32>;

  @fragment
  fn main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
    let texCoord = vec2f(fragCoord.x / ${canvas.width}.0, 1.0 - fragCoord.y / ${canvas.height}.0);
    return textureSample(textureData, textureSampler, texCoord);
  }
  `;
  
  // レンダリング用のシェーダーモジュールを作成
  const vertexModule = createShaderModule(device, vertexShaderCode);
  const fragmentModule = createShaderModule(device, fragmentShaderCode);
  
  // サンプラーを作成
  sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });
  
  // 時間用のユニフォームバッファを作成
  timeBuffer = device.createBuffer({
    size: 4, // float32 (4バイト)
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  
  // 出力テクスチャを作成
  outputTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
  });
  
  // コンピュートシェーダ用のバインドグループレイアウトを作成
  bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: {
          access: 'write-only',
          format: 'rgba8unorm',
          viewDimension: '2d',
        },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: 'uniform',
        },
      },
    ],
  });
  
  // コンピュートパイプラインを作成
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });

  computePipeline = device.createComputePipeline({
    layout: pipelineLayout,
    compute: {
      module: computeShaderModule,
      entryPoint: 'main',
    },
  });
  
  // レンダリング用のバインドグループレイアウトを作成
  renderBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {},
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {},
      },
    ],
  });
  
  // レンダリングパイプラインを作成
  renderPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [renderBindGroupLayout],
    }),
    vertex: {
      module: vertexModule,
      entryPoint: 'main',
    },
    fragment: {
      module: fragmentModule,
      entryPoint: 'main',
      targets: [
        {
          format: format,
        },
      ],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });
}

// キャンバスサイズ変更時のリソース更新
function updateCanvasResources(device, format, canvas) {
  // 既存のテクスチャがあれば破棄
  if (outputTexture) {
    outputTexture.destroy();
  }
  
  // 新しいサイズでテクスチャを再作成
  outputTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
  });
}

// コンピュートシェーダの実行とレンダリング
function executeComputeAndRender(device, context) {
  // コマンドエンコーダの作成
  const commandEncoder = device.createCommandEncoder();
  
  // コンピュートシェーダ用のバインドグループを作成
  const computeBindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: outputTexture.createView(),
      },
      {
        binding: 1,
        resource: {
          buffer: timeBuffer,
        },
      },
    ],
  });
  
  // コンピュートパスの実行
  const computePass = commandEncoder.beginComputePass();
  computePass.setPipeline(computePipeline);
  computePass.setBindGroup(0, computeBindGroup);
  
  // ワークグループ数の計算（8x8のワークグループサイズに基づく）
  const workgroupCountX = Math.ceil(outputTexture.width / 8);
  const workgroupCountY = Math.ceil(outputTexture.height / 8);
  computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY);
  computePass.end();
  
  // レンダリング用のバインドグループを作成
  const renderBindGroup = device.createBindGroup({
    layout: renderBindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: sampler,
      },
      {
        binding: 1,
        resource: outputTexture.createView(),
      },
    ],
  });
  
  // レンダーパスの開始
  const renderPassDescriptor = {
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        storeOp: 'store',
      },
    ],
  };
  
  // レンダーパスを使用してテクスチャを描画
  const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
  renderPass.setPipeline(renderPipeline);
  renderPass.setBindGroup(0, renderBindGroup);
  renderPass.draw(6); // 2つの三角形で四角形を描画（6頂点）
  renderPass.end();
  
  // コマンドの実行
  submitCommands(device, commandEncoder);
}

// メイン関数
export async function initGradientDemo(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    throw new Error(`Canvas with id ${canvasId} not found`);
  }

  try {
    // WebGPUの初期化
    const { device, context } = await initWebGPU(canvas);

    // 初回のCompute Shader実行
    await runComputeShader(device, context, canvas);

    // アニメーションループのセットアップ
    setupAnimationLoop((currentTime) => {
      runComputeShader(device, context, canvas, currentTime);
    });

    // キャンバスのリサイズ処理
    setupResizeObserver(canvas, device, () => {
      // リサイズ時は次のアニメーションフレームで自動的に処理される
    });

    return { device, context };
  } catch (error) {
    displayError(canvas, error.message);
    throw error;
  }
}
