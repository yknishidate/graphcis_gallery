import { 
  loadShader, 
  createBufferFromData,
  createShaderModule,
  setupResizeObserver, 
  setupAnimationLoop,
  ShapeRenderer,
} from './webgpu-utils.js';

// メイン関数
export async function initCirclesDemo(device, context, canvas, format) {
  // シェーダーの読み込み
  const shaderCode = await loadShader('/shaders/circles.wgsl');
  const shaderModule = createShaderModule(device, shaderCode);
  
  // コンピュートパイプラインの作成
  const computePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: shaderModule,
      entryPoint: 'main'
    }
  });
  
  // データの作成
  const numCircles = 256;
  const circleRadius = 0.025; // 正規化された座標系での半径
  const centersData = new Float32Array(numCircles * 2);
  const velocityData = new Float32Array(numCircles * 2);
  const colorsData = new Float32Array(numCircles * 4);
  for (let i = 0; i < numCircles; i++) {
    centersData[i * 2] = Math.random() * 2 - 1;     // x position
    centersData[i * 2 + 1] = Math.random() * 2 - 1; // y position
    velocityData[i * 2 + 0] = (Math.random() - 0.5); // x velocity
    velocityData[i * 2 + 1] = (Math.random() - 0.5); // y velocity
    colorsData[i * 4 + 0] = Math.random() * 0.5 + 0.5; // r
    colorsData[i * 4 + 1] = Math.random() * 0.5 + 0.5; // g
    colorsData[i * 4 + 2] = Math.random() * 0.5 + 0.5; // b
    colorsData[i * 4 + 3] = 1.0;                       // a
  }

  // storageバッファの作成
  const centersBuffer = createBufferFromData(device, centersData, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
  const velocityBuffer = createBufferFromData(device, velocityData, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
  const colorsBuffer = createBufferFromData(device, colorsData, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);

  // uniformバッファの作成
  const uniformBuffer = device.createBuffer({
    size: 16, // vec2<f32> screenSize + f32 deltaTime + f32 radius
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  // バインドグループの作成
  const bindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: centersBuffer } },
      { binding: 2, resource: { buffer: velocityBuffer } }
    ]
  });

  // ShapeRendererの作成
  const shapeRenderer = new ShapeRenderer(device, context, format);

  // リサイズオブザーバーのセットアップ
  setupResizeObserver(canvas, device);

  // アニメーションループのセットアップ
  let lastTime = 0;
  setupAnimationLoop((currentTime) => {
    currentTime *= 0.001; // convert to seconds
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    // uniformバッファの更新
    device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([
      canvas.width, canvas.height, deltaTime, circleRadius
    ]));

    const commandEncoder = device.createCommandEncoder();
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, bindGroup);
    computePass.dispatchWorkgroups(Math.ceil(numCircles / 64));
    computePass.end();

    device.queue.submit([commandEncoder.finish()]);

    // 円を描画
    shapeRenderer.renderCircles(centersBuffer, circleRadius, colorsBuffer, numCircles);
  });
}
