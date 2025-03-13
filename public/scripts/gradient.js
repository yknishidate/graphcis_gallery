import { 
  createShaderModule, 
  setupAnimationLoop,
  TextureRenderer,
  initDemo
} from './webgpu-utils.js';

// ページ読み込み時にデモを初期化
document.addEventListener('DOMContentLoaded', () => initDemo(
  async (device, context, canvas, format) => {
    // テクスチャ描画用のレンダラーを作成
    const textureRenderer = new TextureRenderer(device, format, canvas);
    
    // 時間用のユニフォームバッファを作成
    const timeBuffer = device.createBuffer({
      size: 4, // float32 (4バイト)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    
    // 出力テクスチャを作成
    let outputTexture = device.createTexture({
      size: [canvas.width, canvas.height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | 
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_SRC,
    });
    
    // コンピュートシェーダの読み込み
    const response = await fetch(`/graphics_gallery/shaders/gradient.wgsl`);
    const shaderCode = await response.text();
    const computeShaderModule = createShaderModule(device, shaderCode);
    
    // コンピュートパイプラインを作成
    const computePipeline = device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: computeShaderModule,
        entryPoint: 'main',
      },
    });
  
    // バインドグループを作成
    const computeBindGroup = device.createBindGroup({
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: outputTexture.createView() },
        { binding: 1, resource: { buffer: timeBuffer} },
      ],
    });
  
    setupAnimationLoop((currentTime) => {
      // キャンバスサイズが変更された場合、出力テクスチャを再作成
      if (outputTexture.width !== canvas.width || outputTexture.height !== canvas.height) {
        if (outputTexture) {
          outputTexture.destroy();
        }
        
        outputTexture = device.createTexture({
          size: [canvas.width, canvas.height],
          format: 'rgba8unorm',
          usage: GPUTextureUsage.STORAGE_BINDING |
                 GPUTextureUsage.TEXTURE_BINDING |
                 GPUTextureUsage.COPY_SRC,
        });
      }
    
      // 時間値を更新
      const timeData = new Float32Array([currentTime]);
      device.queue.writeBuffer(timeBuffer, 0, timeData);
    
      // ディスパッチ
      const commandEncoder = device.createCommandEncoder();
      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, computeBindGroup);
      const workgroupCountX = Math.ceil(outputTexture.width / 8);
      const workgroupCountY = Math.ceil(outputTexture.height / 8);
      computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY);
      computePass.end();
      
      // コマンドの実行
      device.queue.submit([commandEncoder.finish()]);
      
      // テクスチャをフルスクリーンで描画
      textureRenderer.render(context, outputTexture);
    });
  }
));
