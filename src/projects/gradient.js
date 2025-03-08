// WebGPU グラデーションデモ（Compute Shader使用）

// WebGPUデバイスの初期化
async function initWebGPU(canvas) {
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

// グローバル変数
let timeBuffer;
let computeShaderModule;
let computePipeline;
let bindGroupLayout;
let outputTexture;
let sampler;
let renderPipeline;
let vertexBuffer;
let renderBindGroupLayout;

// 頂点シェーダとフラグメントシェーダのコード
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
  
  var texCoord = array<vec2f, 6>(
    vec2f(0.0, 1.0),
    vec2f(1.0, 1.0),
    vec2f(0.0, 0.0),
    vec2f(0.0, 0.0),
    vec2f(1.0, 1.0),
    vec2f(1.0, 0.0)
  );
  
  return vec4f(pos[vertexIndex], 0.0, 1.0);
}
`;

// Compute Shaderの読み込みと実行
async function runComputeShader(device, context, canvas, currentTime = 0) {
  const format = context.getCurrentTexture().format;
  
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

  // 初回のみシェーダーファイルを読み込む
  if (!computeShaderModule) {
    const shaderResponse = await fetch('/shaders/gradient.comp.wgsl');
    if (!shaderResponse.ok) {
      throw new Error('Compute Shaderファイルの読み込みに失敗しました。');
    }
    const shaderCode = await shaderResponse.text();
    computeShaderModule = device.createShaderModule({
      code: shaderCode,
    });
    
    // レンダリング用のシェーダーモジュールを作成
    const vertexModule = device.createShaderModule({
      code: vertexShaderCode,
    });
    
    const fragmentModule = device.createShaderModule({
      code: fragmentShaderCode,
    });
    
    // サンプラーを作成
    sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
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

  // 初回のみ時間用のユニフォームバッファを作成
  if (!timeBuffer) {
    timeBuffer = device.createBuffer({
      size: 4, // float32 (4バイト)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  // 時間値を更新
  const timeData = new Float32Array([currentTime]);
  device.queue.writeBuffer(timeBuffer, 0, timeData);

  // 初回のみ出力テクスチャを作成
  if (!outputTexture || 
      outputTexture.width !== canvas.width || 
      outputTexture.height !== canvas.height) {
    // 既存のテクスチャがあれば破棄
    if (outputTexture) {
      outputTexture.destroy();
    }
    
    outputTexture = device.createTexture({
      size: [canvas.width, canvas.height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
    });
  }

  // 初回のみバインドグループレイアウトを作成
  if (!bindGroupLayout) {
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
  }

  // 初回のみパイプラインを作成
  if (!computePipeline) {
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

  // バインドグループの作成（毎フレーム新しいテクスチャとともに作成）
  const bindGroup = device.createBindGroup({
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

  // コマンドエンコーダの作成
  const commandEncoder = device.createCommandEncoder();

  // Compute Passの実行
  const computePass = commandEncoder.beginComputePass();
  computePass.setPipeline(computePipeline);
  computePass.setBindGroup(0, bindGroup);

  // ワークグループ数の計算（8x8のワークグループサイズに基づく）
  const workgroupCountX = Math.ceil(canvas.width / 8);
  const workgroupCountY = Math.ceil(canvas.height / 8);
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

  // 計算結果をキャンバスに描画
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

  // コマンドバッファの作成と送信
  const commandBuffer = commandEncoder.finish();
  device.queue.submit([commandBuffer]);

  return outputTexture;
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
    let outputTexture = await runComputeShader(device, context, canvas);

    // アニメーションループ関数
    function animate(currentTime) {
      // 次のフレームをリクエスト
      requestAnimationFrame(animate);
      
      // 毎フレームレンダリング（現在の時間を渡す）
      runComputeShader(device, context, canvas, currentTime);
    }

    // アニメーションループを開始
    requestAnimationFrame(animate);

    // キャンバスのリサイズ処理
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const canvas = entry.target;
        const width = entry.contentBoxSize[0].inlineSize;
        const height = entry.contentBoxSize[0].blockSize;
        
        canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
        canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
        
        // リサイズ後にテクスチャを再作成する必要がある場合は、
        // ここで追加の処理を行うことができます
      }
    });
    
    observer.observe(canvas);

    return { device, context };
  } catch (error) {
    console.error('WebGPUの初期化エラー:', error);
    
    // エラーメッセージをキャンバス上に表示
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#ff6b6b';
    ctx.textAlign = 'center';
    ctx.fillText('WebGPUエラー: ' + error.message, canvas.width / 2, canvas.height / 2);
    
    throw error;
  }
}
