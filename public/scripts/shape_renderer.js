import { 
  createBufferFromData,
  setupResizeObserver, 
  setupAnimationLoop,
  ShapeRenderer,
  initDemo
} from './webgpu-utils.js';

// ページ読み込み時にデモを初期化
document.addEventListener('DOMContentLoaded', () => initDemo(
  async (device, context, canvas, format) => {
    
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
    const colorsBuffer = createBufferFromData(device, colorsData, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
  
    // ShapeRendererの作成
    const shapeRenderer = new ShapeRenderer(device, context, format);
  
    // アニメーションループのセットアップ
    let lastTime = 0;
    setupAnimationLoop((currentTime) => {
      currentTime *= 0.001; // convert to seconds
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      // 円の位置を更新（CPU計算）
      for (let i = 0; i < numCircles; i++) {
        // 新しい位置を計算
        centersData[i * 2] += velocityData[i * 2] * deltaTime;
        centersData[i * 2 + 1] += velocityData[i * 2 + 1] * deltaTime;

        // 画面端での反射
        if (centersData[i * 2] > 1.0 || centersData[i * 2] < -1.0) {
          velocityData[i * 2] *= -1;
        }
        if (centersData[i * 2 + 1] > 1.0 || centersData[i * 2 + 1] < -1.0) {
          velocityData[i * 2 + 1] *= -1;
        }
      }

      // 更新された位置データをGPUバッファにコピー
      device.queue.writeBuffer(centersBuffer, 0, centersData);

      // 円を描画
      shapeRenderer.renderCircles(centersBuffer, circleRadius, colorsBuffer, numCircles);
    });
  }
));
