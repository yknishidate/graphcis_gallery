import { createDefaultRenderPassDescriptor, initDemo } from './webgpu-utils.js';

document.addEventListener('DOMContentLoaded', () => initDemo(
  async (device, context, canvas, format) => {
    // シェーダーファイルの読み込み
    const response = await fetch(`/graphics_gallery/shaders/triangle.wgsl`);
    const shaderCode = await response.text();
    const shaderModule = device.createShaderModule({ code: shaderCode });

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
    const renderPassDescriptor = createDefaultRenderPassDescriptor(context);
    const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
    renderPass.setPipeline(pipeline);
    renderPass.draw(3); // 3頂点で三角形を描画
    renderPass.end();
    device.queue.submit([commandEncoder.finish()]);
  }
));
