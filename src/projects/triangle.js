// WebGPU 三角形デモ

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

// シェーダーモジュールの作成
async function createShaderModule(device) {
  // シェーダーファイルの読み込み
  const vertexShaderResponse = await fetch('/shaders/triangle.vert.wgsl');
  const fragmentShaderResponse = await fetch('/shaders/triangle.frag.wgsl');
  
  if (!vertexShaderResponse.ok || !fragmentShaderResponse.ok) {
    throw new Error('シェーダーファイルの読み込みに失敗しました。');
  }
  
  const vertexShader = await vertexShaderResponse.text();
  const fragmentShader = await fragmentShaderResponse.text();

  // シェーダーモジュールの作成
  const vertexModule = device.createShaderModule({
    code: vertexShader,
  });

  const fragmentModule = device.createShaderModule({
    code: fragmentShader,
  });

  return { vertexModule, fragmentModule };
}

// レンダリングパイプラインの作成
function createRenderPipeline(device, format, shaderModules) {
  const { vertexModule, fragmentModule } = shaderModules;

  const pipelineDescriptor = {
    layout: 'auto',
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
  };

  return device.createRenderPipeline(pipelineDescriptor);
}

// レンダリング関数
function render(device, context, pipeline) {
  // コマンドエンコーダの作成
  const commandEncoder = device.createCommandEncoder();

  // レンダーパスの設定
  const renderPassDescriptor = {
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  };

  // レンダーパスエンコーダの作成
  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
  passEncoder.setPipeline(pipeline);
  passEncoder.draw(3); // 3頂点で三角形を描画
  passEncoder.end();

  // コマンドバッファの作成と送信
  const commandBuffer = commandEncoder.finish();
  device.queue.submit([commandBuffer]);
}

// メイン関数
export async function initTriangleDemo(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    throw new Error(`Canvas with id ${canvasId} not found`);
  }

  try {
    // WebGPUの初期化
    const { device, context, format } = await initWebGPU(canvas);

    // シェーダーモジュールの作成
    const shaderModules = await createShaderModule(device);

    // レンダリングパイプラインの作成
    const pipeline = createRenderPipeline(device, format, shaderModules);

    // レンダリング
    render(device, context, pipeline);

    // キャンバスのリサイズ処理
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const canvas = entry.target;
        const width = entry.contentBoxSize[0].inlineSize;
        const height = entry.contentBoxSize[0].blockSize;
        
        canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
        canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
        
        // リサイズ後に再レンダリング
        render(device, context, pipeline);
      }
    });
    
    observer.observe(canvas);

    return { device, context, pipeline };
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
