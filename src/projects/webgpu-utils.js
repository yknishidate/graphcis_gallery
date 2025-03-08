// WebGPU ユーティリティ関数

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
