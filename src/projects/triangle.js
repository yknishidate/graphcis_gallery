import { 
  initWebGPU, 
  loadShader, 
  createShaderModule, 
  beginRenderPass, 
  submitCommands 
} from './webgpu-utils.js';

export async function initTriangleDemo(canvas) {
  // WebGPUの初期化
  const { device, context, format } = await initWebGPU(canvas);

  // シェーダーファイルの読み込み
  const shader = await loadShader('/shaders/triangle.wgsl');

  // シェーダーモジュールの作成
  const shaderModule = createShaderModule(device, shader);

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

  return { device, context, pipeline };
}
