import { 
  initWebGPU, 
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

    const numCircles = 1000;
    const circleRadius = 0.01; // 正規化された座標系での半径

    // ShapeRendererの作成
    const shapeRenderer = new ShapeRenderer(device, format, 'circle');

    // リサイズオブザーバーのセットアップ
    setupResizeObserver(canvas, device);

    // ランダムな円のインスタンスを生成
    const instances = [];
    for (let i = 0; i < numCircles; i++) {
      instances.push({
        center: [
          Math.random() * 2 - 1,  // x: -1 から 1
          Math.random() * 2 - 1   // y: -1 から 1
        ],
        radius: circleRadius,
        color: [
          Math.random(), // R
          Math.random(), // G
          Math.random(), // B
          1.0           // A
        ]
      });
    }

    // メインのレンダリングループ
    function frame() {
      // コマンドエンコーダの作成
      const commandEncoder = device.createCommandEncoder();

      // レンダーパスの開始
      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store'
        }]
      });

      // インスタンスデータの更新と描画
      shapeRenderer.updateInstances(instances);
      shapeRenderer.render(renderPass, numCircles);

      renderPass.end();

      // コマンドの実行
      device.queue.submit([commandEncoder.finish()]);
    }

    // アニメーションループのセットアップ
    setupAnimationLoop(frame);

    return { device, context };
  } catch (error) {
    displayError(canvas, error.message);
    throw error;
  }
}
