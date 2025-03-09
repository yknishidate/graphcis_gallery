import { 
  initWebGPU, 
  loadShader, 
  createShaderModule, 
  setupResizeObserver, 
  displayError, 
  submitCommands,
  setupAnimationLoop,
  FullscreenQuadRenderer
} from './webgpu-utils.js';

// グローバル変数（リソース管理用）
let timeBuffer;
let computeShaderModule;
let computePipeline;
let bindGroupLayout;
let outputTexture;
let quadRenderer; // フルスクリーン描画用のレンダラー

// Compute Shaderの実行とレンダリング
async function runComputeShader(device, context, canvas, currentTime = 0) {
  const format = context.getCurrentTexture().format;
  
  // 初期化（初回のみ実行）
  if (!computeShaderModule) {
    await initializeResources(device, format, canvas);
  }

  // キャンバスサイズが変更された場合、出力テクスチャを再作成
  if (outputTexture.width !== canvas.width || outputTexture.height !== canvas.height) {
    updateCanvasResources(device, canvas);
    // レンダラーのリサイズ
    quadRenderer.resize(canvas);
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
  const computeShaderCode = await loadShader('/shaders/gradient.wgsl');
  computeShaderModule = createShaderModule(device, computeShaderCode);
  
  // フルスクリーン描画用のレンダラーを作成
  quadRenderer = new FullscreenQuadRenderer(device, format, canvas);
  
  // 時間用のユニフォームバッファを作成
  timeBuffer = device.createBuffer({
    size: 4, // float32 (4バイト)
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  
  // 出力テクスチャを作成
  outputTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.STORAGE_BINDING | 
           GPUTextureUsage.TEXTURE_BINDING |
           GPUTextureUsage.COPY_SRC,
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
}

// キャンバスサイズ変更時のリソース更新
function updateCanvasResources(device, canvas) {
  // 既存のテクスチャがあれば破棄
  if (outputTexture) {
    outputTexture.destroy();
  }
  
  // 新しいサイズでテクスチャを再作成
  outputTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.STORAGE_BINDING |
           GPUTextureUsage.TEXTURE_BINDING |
           GPUTextureUsage.COPY_SRC,
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
  
  // コマンドの実行
  submitCommands(device, commandEncoder);
  
  // テクスチャをフルスクリーンで描画（簡潔になったレンダリング処理）
  quadRenderer.render(context, outputTexture);
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

    return { device, context };
  } catch (error) {
    displayError(canvas, error.message);
    throw error;
  }
}
