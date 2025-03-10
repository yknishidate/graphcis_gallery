import { 
  createShaderModule, 
  beginRenderPass, 
  submitCommands 
} from './webgpu-utils.js';
import shaderCode from './shaders/triangle.wgsl?raw';

export async function initTriangleDemo(device, context, canvas, format) {
  // シェーダーファイルの読み込み
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
