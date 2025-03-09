// WebGPU ユーティリティ関数

// フルスクリーン四角形の頂点シェーダコード
const fullscreenQuadVertexShaderCode = `
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

// フルスクリーンテクスチャ描画用のフラグメントシェーダコード
function createFullscreenTextureFragmentShaderCode(canvasWidth, canvasHeight) {
  return `
  @group(0) @binding(0) var textureSampler: sampler;
  @group(0) @binding(1) var textureData: texture_2d<f32>;

  @fragment
  fn main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
    let texCoord = vec2f(fragCoord.x / ${canvasWidth}.0, 1.0 - fragCoord.y / ${canvasHeight}.0);
    return textureSample(textureData, textureSampler, texCoord);
  }
  `;
}

// フルスクリーン四角形描画用のパイプラインとリソースを作成
export function createFullscreenQuadPipeline(device, format, canvas) {
  // シェーダーモジュールを作成
  const vertexModule = createShaderModule(device, fullscreenQuadVertexShaderCode);
  const fragmentModule = createShaderModule(
    device, 
    createFullscreenTextureFragmentShaderCode(canvas.width, canvas.height)
  );
  
  // サンプラーを作成
  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });
  
  // バインドグループレイアウトを作成
  const bindGroupLayout = device.createBindGroupLayout({
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
  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
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
  
  return { pipeline, bindGroupLayout, sampler };
}

// テクスチャをフルスクリーンで描画
export function renderFullscreenTexture(device, context, texture, pipeline, bindGroupLayout, sampler) {
  // コマンドエンコーダの作成
  const commandEncoder = device.createCommandEncoder();
  
  // バインドグループを作成
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: sampler,
      },
      {
        binding: 1,
        resource: texture.createView(),
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
  renderPass.setPipeline(pipeline);
  renderPass.setBindGroup(0, bindGroup);
  renderPass.draw(6); // 2つの三角形で四角形を描画（6頂点）
  renderPass.end();
  
  // コマンドの実行
  submitCommands(device, commandEncoder);
}

// WebGPUデバイスの初期化
export async function initWebGPU(canvas) {
  // WebGPUがサポートされているか確認
  if (!navigator.gpu) {
    throw new Error('WebGPUはこのブラウザでサポートされていません。');
  }

  // アダプタの要求
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error('WebGPUアダプタが見つかりません。');
  }

  // デバイスの要求
  const device = await adapter.requestDevice();

  // キャンバスのコンテキストを設定
  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format,
    alphaMode: 'premultiplied',
  });

  return { device, context, format };
}

// シェーダーファイルの読み込み
export async function loadShader(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`シェーダーファイル ${path} の読み込みに失敗しました。`);
  }
  return await response.text();
}

// シェーダーモジュールの作成
export function createShaderModule(device, code) {
  return device.createShaderModule({
    code: code,
  });
}

// キャンバスリサイズ処理のセットアップ
export function setupResizeObserver(canvas, device, onResize) {
  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const canvas = entry.target;
      const width = entry.contentBoxSize[0].inlineSize;
      const height = entry.contentBoxSize[0].blockSize;
      
      canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
      canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
      
      // リサイズ後のコールバック実行
      if (onResize) {
        onResize(canvas);
      }
    }
  });
  
  observer.observe(canvas);
  return observer;
}

// エラーメッセージの表示
export function displayError(canvas, errorMessage) {
  console.error('WebGPUエラー:', errorMessage);
  
  // エラーメッセージをキャンバス上に表示
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1e1e2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#ff6b6b';
  ctx.textAlign = 'center';
  ctx.fillText('WebGPUエラー: ' + errorMessage, canvas.width / 2, canvas.height / 2);
}

// レンダーパスの開始
export function beginRenderPass(device, context, clearColor = { r: 0.1, g: 0.1, b: 0.15, a: 1.0 }) {
  const commandEncoder = device.createCommandEncoder();
  
  const renderPassDescriptor = {
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        clearValue: clearColor,
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  };
  
  return { 
    commandEncoder, 
    renderPass: commandEncoder.beginRenderPass(renderPassDescriptor) 
  };
}

// コマンドの実行
export function submitCommands(device, commandEncoder) {
  const commandBuffer = commandEncoder.finish();
  device.queue.submit([commandBuffer]);
}

// アニメーションループのセットアップ
export function setupAnimationLoop(callback) {
  function animate(currentTime) {
    requestAnimationFrame(animate);
    callback(currentTime);
  }
  
  requestAnimationFrame(animate);
}
