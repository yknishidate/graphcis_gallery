import { 
  createShaderModule, 
  beginRenderPass, 
  submitCommands 
} from './webgpu-utils.js';

export async function initTriangleDemo(device, context, canvas, format) {
  // シェーダーファイルの読み込み
  const response = await fetch(`../shaders/triangle.wgsl`);
  const shaderCode = await response.text();
  const shaderModule = createShaderModule(device, shaderCode);

  // レンダリングパイプラインの作成
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
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

  // レンダーパスの開始
  const { commandEncoder, renderPass } = beginRenderPass(device, context);
  renderPass.setPipeline(pipeline);
  renderPass.draw(3); // 3頂点で三角形を描画
  renderPass.end();
  submitCommands(device, commandEncoder);
}

async function initDemo() {
  try {
    const canvas = document.getElementById('webgpu-canvas');
    if (!canvas) {
      throw new Error('キャンバス要素が見つかりません。');
    }
    
    // キャンバスのサイズを設定
    const demoContainer = document.querySelector('.demo-container');
    canvas.width = demoContainer.clientWidth;
    canvas.height = 400;

    // WebGPUのサポートチェック
    if (!navigator.gpu) {
      throw new Error('WebGPUはこのブラウザでサポートされていません。Chrome 113以降またはその他の対応ブラウザをお使いください。');
    }

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
    
    await initTriangleDemo(device, context, canvas, format);
  } catch (error) {
    console.error('エラー:', error);
    
    // エラーメッセージを表示
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = `エラー: ${error.message}`;
    errorElement.style.display = 'block';
    
    // キャンバスを非表示
    const canvas = document.getElementById('webgpu-canvas');
    canvas.style.display = 'none';
  }
}

// ページ読み込み時にデモを初期化
document.addEventListener('DOMContentLoaded', initDemo);
