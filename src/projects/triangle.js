// WebGPU 三角形デモ
import { 
  initWebGPU, 
  loadShader, 
  createShaderModule, 
  setupResizeObserver, 
  displayError, 
  beginRenderPass, 
  submitCommands 
} from './webgpu-utils.js';

// シェーダーモジュールの作成
async function loadShaderModules(device) {
  // シェーダーファイルの読み込み
  const vertexShader = await loadShader('/shaders/triangle.vert.wgsl');
  const fragmentShader = await loadShader('/shaders/triangle.frag.wgsl');

  // シェーダーモジュールの作成
  const vertexModule = createShaderModule(device, vertexShader);
  const fragmentModule = createShaderModule(device, fragmentShader);

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
  // レンダーパスの開始
  const { commandEncoder, renderPass } = beginRenderPass(device, context);
  
  // 描画コマンドの設定
  renderPass.setPipeline(pipeline);
  renderPass.draw(3); // 3頂点で三角形を描画
  renderPass.end();

  // コマンドの実行
  submitCommands(device, commandEncoder);
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
    const shaderModules = await loadShaderModules(device);

    // レンダリングパイプラインの作成
    const pipeline = createRenderPipeline(device, format, shaderModules);

    // レンダリング
    render(device, context, pipeline);

    // キャンバスのリサイズ処理
    setupResizeObserver(canvas, device, () => {
      render(device, context, pipeline);
    });

    return { device, context, pipeline };
  } catch (error) {
    displayError(canvas, error.message);
    throw error;
  }
}
