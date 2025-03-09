import { 
  initWebGPU, 
  loadShader, 
  createShaderModule, 
  submitCommands,
  setupAnimationLoop,
  TextureRenderer
} from './webgpu-utils.js';

export async function initGradientDemo(canvas) {
  // WebGPUの初期化
  const { device, context, format } = await initWebGPU(canvas);

  // フルスクリーン描画用のレンダラーを作成
  const textureRenderer = new TextureRenderer(device, format, canvas);
  
  // 時間用のユニフォームバッファを作成
  const timeBuffer = device.createBuffer({
    size: 4, // float32 (4バイト)
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  
  // 出力テクスチャを作成
  const outputTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.STORAGE_BINDING | 
    GPUTextureUsage.TEXTURE_BINDING |
    GPUTextureUsage.COPY_SRC,
  });
  
  // コンピュートシェーダの読み込み
  const computeShaderCode = await loadShader('/shaders/gradient.wgsl');
  const computeShaderModule = createShaderModule(device, computeShaderCode);
  
  // コンピュートパイプラインを作成
  const computePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: computeShaderModule,
      entryPoint: 'main',
    },
  });

  setupAnimationLoop((currentTime) => {
    // キャンバスサイズが変更された場合、出力テクスチャを再作成
    if (outputTexture.width !== canvas.width || outputTexture.height !== canvas.height) {
      // 既存のテクスチャがあれば破棄
      if (outputTexture) {
        outputTexture.destroy();
      }
      
      // 新しいサイズでテクスチャを再作成
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
  
    // コマンドエンコーダの作成
    const commandEncoder = device.createCommandEncoder();
    
    // コンピュートシェーダ用のバインドグループを作成
    const computeBindGroup = device.createBindGroup({
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: outputTexture.createView() },
        { binding: 1, resource: { buffer: timeBuffer} },
      ],
    });
  
    // コンピュートパスの実行
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, computeBindGroup);
    
    // ワークグループ数の計算（8x8のワークグループサイズに基づく）
    const workgroupCountX = Math.ceil(outputTexture.width / 8);
    const workgroupCountY = Math.ceil(outputTexture.height / 8);
    computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY);
    computePass.end();
    
    // コマンドの実行
    submitCommands(device, commandEncoder);
    
    // テクスチャをフルスクリーンで描画
    textureRenderer.render(context, outputTexture);
  });

  return { device, context };
}
