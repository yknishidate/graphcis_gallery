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
    
    // 円のデータ作成
    const numCircles = 128;
    const circleRadius = 0.025;
    const circleCenters = new Float32Array(numCircles * 2);
    const circleVelocities = new Float32Array(numCircles * 2);
    const circleColors = new Float32Array(numCircles * 4);
    for (let i = 0; i < numCircles; i++) {
      circleCenters[i * 2] = Math.random() * 2 - 1;     // x position
      circleCenters[i * 2 + 1] = Math.random() * 2 - 1; // y position
      circleVelocities[i * 2] = (Math.random() - 0.5);  // x velocity
      circleVelocities[i * 2 + 1] = (Math.random() - 0.5); // y velocity
      circleColors[i * 4] = Math.random() * 0.5 + 0.5;  // r
      circleColors[i * 4 + 1] = Math.random() * 0.5 + 0.5; // g
      circleColors[i * 4 + 2] = Math.random() * 0.5 + 0.5; // b
      circleColors[i * 4 + 3] = 1.0;                    // a
    }

    // 四角形のデータ作成
    const numRectangles = 64;
    const rectangleSize = 0.04;
    const rectangleCenters = new Float32Array(numRectangles * 2);
    const rectangleVelocities = new Float32Array(numRectangles * 2);
    const rectangleColors = new Float32Array(numRectangles * 4);
    for (let i = 0; i < numRectangles; i++) {
      rectangleCenters[i * 2] = Math.random() * 2 - 1;     // x position
      rectangleCenters[i * 2 + 1] = Math.random() * 2 - 1; // y position
      rectangleVelocities[i * 2] = (Math.random() - 0.5);  // x velocity
      rectangleVelocities[i * 2 + 1] = (Math.random() - 0.5); // y velocity
      rectangleColors[i * 4] = Math.random() * 0.5 + 0.5;  // r
      rectangleColors[i * 4 + 1] = Math.random() * 0.5 + 0.5; // g
      rectangleColors[i * 4 + 2] = Math.random() * 0.5 + 0.5; // b
      rectangleColors[i * 4 + 3] = 1.0;                    // a
    }
  
    // GPUバッファの作成
    const circleCentersBuffer = createBufferFromData(device, circleCenters, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    const circleColorsBuffer = createBufferFromData(device, circleColors, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    const rectangleCentersBuffer = createBufferFromData(device, rectangleCenters, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    const rectangleColorsBuffer = createBufferFromData(device, rectangleColors, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
  
    // ShapeRendererの作成
    const shapeRenderer = new ShapeRenderer(device, context, format);
  
    // アニメーションループのセットアップ
    let lastTime = 0;
    setupAnimationLoop((currentTime) => {
      currentTime *= 0.001; // convert to seconds
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      // 円の位置を更新
      for (let i = 0; i < numCircles; i++) {
        circleCenters[i * 2] += circleVelocities[i * 2] * deltaTime;
        circleCenters[i * 2 + 1] += circleVelocities[i * 2 + 1] * deltaTime;

        if (circleCenters[i * 2] > 1.0 || circleCenters[i * 2] < -1.0) {
          circleVelocities[i * 2] *= -1;
        }
        if (circleCenters[i * 2 + 1] > 1.0 || circleCenters[i * 2 + 1] < -1.0) {
          circleVelocities[i * 2 + 1] *= -1;
        }
      }

      // 四角形の位置を更新
      for (let i = 0; i < numRectangles; i++) {
        rectangleCenters[i * 2] += rectangleVelocities[i * 2] * deltaTime;
        rectangleCenters[i * 2 + 1] += rectangleVelocities[i * 2 + 1] * deltaTime;

        if (rectangleCenters[i * 2] > 1.0 || rectangleCenters[i * 2] < -1.0) {
          rectangleVelocities[i * 2] *= -1;
        }
        if (rectangleCenters[i * 2 + 1] > 1.0 || rectangleCenters[i * 2 + 1] < -1.0) {
          rectangleVelocities[i * 2 + 1] *= -1;
        }
      }

      // 更新された位置データをGPUバッファにコピー
      device.queue.writeBuffer(circleCentersBuffer, 0, circleCenters);
      device.queue.writeBuffer(rectangleCentersBuffer, 0, rectangleCenters);

      // 円と四角形を描画
      shapeRenderer.renderCircles(circleCentersBuffer, circleRadius, circleColorsBuffer, numCircles);
      shapeRenderer.renderRectangles(rectangleCentersBuffer, rectangleSize, rectangleColorsBuffer, numRectangles);
    });
  }
));
