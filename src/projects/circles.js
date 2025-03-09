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

    const numCircles = 1024;
    const circleRadius = 0.025; // 正規化された座標系での半径

    // シェーダーの読み込み
    const shaderCode = await loadShader('/shaders/circles.wgsl');
    const shaderModule = createShaderModule(device, shaderCode);

    // コンピュートパイプラインの作成
    const computePipeline = device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: shaderModule,
        entryPoint: 'update_circles'
      }
    });

    // 円のデータを生成
    const circleData = new Float32Array(numCircles * 5);
    for (let i = 0; i < numCircles; i++) {
      circleData[i * 4 + 0] = Math.random() * 2 - 1; // x position
      circleData[i * 4 + 1] = Math.random() * 2 - 1; // y position
      // circleData[i * 4 + 2] = (Math.random() - 0.5) * 0.01;  // x velocity
      // circleData[i * 4 + 3] = (Math.random() - 0.5) * 0.01;  // y velocity
      circleData[i * 4 + 2] = 0.0;  // x velocity
      circleData[i * 4 + 3] = 0.0;  // y velocity
    }

    // ストレージバッファの作成
    const circlesBuffer = device.createBuffer({
      size: circleData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(circlesBuffer.getMappedRange()).set(circleData);
    circlesBuffer.unmap();

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
        { binding: 1, resource: { buffer: circlesBuffer } }
      ]
    });

    // ShapeRendererの作成
    const shapeRenderer = new ShapeRenderer(device, format, 'circle');

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

      // コンピュートパス
      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(Math.ceil(numCircles / 64));
      computePass.end();
      
      device.queue.submit([commandEncoder.finish()]);

      // インスタンスデータの準備
      const instances = [];
      for (let i = 0; i < numCircles; i++) {
        instances.push({
          center: [
            circleData[i * 4], 
            circleData[i * 4 + 1]
          ],
          radius: circleRadius,
          color: [
            1.0,
            1.0,
            1.0,
            1.0
          ]
        });
      }

      // インスタンスデータの更新と描画
      shapeRenderer.render(context, instances);
    }

    // アニメーションループのセットアップ
    setupAnimationLoop(frame);

    return { device, context };
  } catch (error) {
    displayError(canvas, error.message);
    throw error;
  }
}
