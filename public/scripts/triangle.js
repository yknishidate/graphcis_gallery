import { 
  createShaderModule, 
  beginRenderPass, 
  submitCommands,
  initDemo
} from './webgpu-utils.js';

export async function initTriangleDemo(device, context, canvas, format) {
  // シェーダーファイルの読み込み
  const response = await fetch(`/graphics_gallery/shaders/triangle.wgsl`);
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

// ページ読み込み時にデモを初期化
document.addEventListener('DOMContentLoaded', () => initDemo(initTriangleDemo));
