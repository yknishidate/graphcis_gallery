import { 
  initWebGPU, 
  loadShader, 
  createShaderModule,
  setupResizeObserver, 
  displayError, 
  setupAnimationLoop,
  ShapeRenderer
} from './webgpu-utils.js';

// メイン関数
export async function initCirclesDemo(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    throw new Error(`Canvas with id ${canvasId} not found`);
  }

  try {
    // WebGPUの初期化
    const { device, context, format } = await initWebGPU(canvas);

    const numCircles = 256;
    const circleRadius = 0.025; // 正規化された座標系での半径

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

    // centers用のバッファを作成
    const centersBuffer = device.createBuffer({
      size: numCircles * 2 * 4, // vec2f * numCircles
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    const centersData = new Float32Array(numCircles * 2);
    for (let i = 0; i < numCircles; i++) {
      centersData[i * 2] = Math.random() * 2 - 1;     // x position
      centersData[i * 2 + 1] = Math.random() * 2 - 1; // y position
    }
    new Float32Array(centersBuffer.getMappedRange()).set(centersData);
    centersBuffer.unmap();

    // velocity用のバッファを作成
    const velocityBuffer = device.createBuffer({
      size: numCircles * 2 * 4, // vec2f * numCircles
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    const velocityData = new Float32Array(numCircles * 2);
    for (let i = 0; i < numCircles; i++) {
      velocityData[i * 2 + 0] = (Math.random() - 0.5); // x velocity
      velocityData[i * 2 + 1] = (Math.random() - 0.5); // y velocity
    }
    new Float32Array(velocityBuffer.getMappedRange()).set(velocityData);
    velocityBuffer.unmap();

    // colors用のバッファを作成
    const colorsBuffer = device.createBuffer({
      size: numCircles * 4 * 4, // vec4f * numCircles
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    const colorsData = new Float32Array(numCircles * 4);
    for (let i = 0; i < numCircles; i++) {
      colorsData[i * 4 + 0] = Math.random() * 0.5 + 0.5; // r
      colorsData[i * 4 + 1] = Math.random() * 0.5 + 0.5; // g
      colorsData[i * 4 + 2] = Math.random() * 0.5 + 0.5; // b
      colorsData[i * 4 + 3] = 1.0;                       // a
    }
    new Float32Array(colorsBuffer.getMappedRange()).set(colorsData);
    colorsBuffer.unmap();

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

    let lastTime = 0;
    function frame(time) {
      time *= 0.001; // convert to seconds
      const deltaTime = time - lastTime;
      lastTime = time;

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
    }

    // アニメーションループのセットアップ
    setupAnimationLoop(frame);

    return { device, context };
  } catch (error) {
    displayError(canvas, error.message);
    throw error;
  }
}
