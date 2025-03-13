import { 
  createShaderModule, 
  initDemo
} from './webgpu-utils.js';

document.addEventListener('DOMContentLoaded', () => initDemo(
  async (device, context, canvas, format) => {
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
    const commandEncoder = device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    renderPass.setPipeline(pipeline);
    renderPass.draw(3); // 3頂点で三角形を描画
    renderPass.end();
    device.queue.submit([commandEncoder.finish()]);
  }
));
