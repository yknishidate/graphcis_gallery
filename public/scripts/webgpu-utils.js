export class TextureRenderer {
  // プライベート変数
  #device;
  #canvas;
  #pipeline;
  #bindGroupLayout;
  #sampler;
  #uniformBuffer;
  
  // コンストラクタ
  constructor(device, format, canvas) {
    this.#device = device;
    this.#canvas = canvas;
    
    // uniformバッファの作成
    this.#uniformBuffer = device.createBuffer({
      size: 8, // vec2f (width, height)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // 初期キャンバスサイズをuniformバッファに書き込む
    device.queue.writeBuffer(
      this.#uniformBuffer, 
      0, 
      new Float32Array([canvas.width, canvas.height])
    );
    
    // 頂点シェーダコード
    const vertexShaderCode = `
    @vertex
    fn main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
      var pos = array<vec2f, 6>(
        vec2f(-1.0, -1.0),
        vec2f(1.0, -1.0),
        vec2f(-1.0, 1.0),
        vec2f(-1.0, 1.0),
        vec2f(1.0, -1.0),
        vec2f(1.0, 1.0)
      );
      
      return vec4f(pos[vertexIndex], 0.0, 1.0);
    }
    `;
    
    // フラグメントシェーダコード
    const fragmentShaderCode = `
    struct CanvasSize {
      width: f32,
      height: f32,
    }

    @group(0) @binding(0) var textureSampler: sampler;
    @group(0) @binding(1) var textureData: texture_2d<f32>;
    @group(0) @binding(2) var<uniform> canvasSize: CanvasSize;

    @fragment
    fn main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
      let texCoord = vec2f(
        fragCoord.x / canvasSize.width, 
        1.0 - fragCoord.y / canvasSize.height
      );
      return textureSample(textureData, textureSampler, texCoord);
    }
    `;
    
    // シェーダーモジュールを作成
    const vertexModule = device.createShaderModule({
      code: vertexShaderCode,
    });
    const fragmentModule = device.createShaderModule({
      code: fragmentShaderCode,
    });
    
    // サンプラーを作成
    this.#sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
    });
    
    // バインドグループレイアウトを作成
    this.#bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {
            type: 'uniform'
          }
        }
      ],
    });
    
    // レンダリングパイプラインを作成
    this.#pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.#bindGroupLayout],
      }),
      vertex: {
        module: vertexModule,
        entryPoint: 'main',
      },
      fragment: {
        module: fragmentModule,
        entryPoint: 'main',
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
  }
  
  // テクスチャをフルスクリーンで描画
  render(context, texture, clearColor = { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }) {
    // キャンバスサイズをuniformバッファに書き込む
    this.#device.queue.writeBuffer(
      this.#uniformBuffer, 
      0, 
      new Float32Array([this.#canvas.width, this.#canvas.height])
    );

    // コマンドエンコーダの作成
    const commandEncoder = this.#device.createCommandEncoder();
    
    // バインドグループを作成
    const bindGroup = this.#device.createBindGroup({
      layout: this.#bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: this.#sampler,
        },
        {
          binding: 1,
          resource: texture.createView(),
        },
        {
          binding: 2,
          resource: { buffer: this.#uniformBuffer }
        }
      ],
    });
    
    // レンダーパスの開始
    const renderPassDescriptor = {
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadOp: 'clear',
          clearValue: clearColor,
          storeOp: 'store',
        },
      ],
    };
    
    // レンダーパスを使用してテクスチャを描画
    const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
    renderPass.setPipeline(this.#pipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(6); // 2つの三角形で四角形を描画（6頂点）
    renderPass.end();
    
    // コマンドの実行
    this.#device.queue.submit([commandEncoder.finish()]);
  }
}

// キャンバスリサイズ処理のセットアップ
export function setupResizeObserver(canvas, device, onResize) {
  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const canvas = entry.target;
      const width = entry.contentBoxSize[0].inlineSize;
      const height = entry.contentBoxSize[0].blockSize;
      
      canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
      canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
      
      // リサイズ後のコールバック実行
      if (onResize) {
        onResize(canvas);
      }
    }
  });
  
  observer.observe(canvas);
  return observer;
}

// エラーメッセージの表示
export function displayError(canvas, errorMessage) {
  console.error('WebGPUエラー:', errorMessage);
  
  // エラーメッセージをキャンバス上に表示
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1e1e2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#ff6b6b';
  ctx.textAlign = 'center';
  ctx.fillText('WebGPUエラー: ' + errorMessage, canvas.width / 2, canvas.height / 2);
}

export function createDefaultRenderPassDescriptor(context, clearColor = { r: 0.1, g: 0.1, b: 0.15, a: 1.0 }) {
  return {
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        clearValue: clearColor,
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  };
}

// レンダーパスの開始
export function beginRenderPass(device, context, clearColor = { r: 0.1, g: 0.1, b: 0.15, a: 1.0 }) {
  const commandEncoder = device.createCommandEncoder();
  
  const renderPassDescriptor = {
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        clearValue: clearColor,
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  };
  
  return { 
    commandEncoder, 
    renderPass: commandEncoder.beginRenderPass(renderPassDescriptor) 
  };
}

// バッファ作成のユーティリティ関数
// device: GPUDevice
// data: Float32Array | Uint32Array | ... などのバッファデータ
// usage: GPUBufferUsageFlags
// options?: { mappedAtCreation?: boolean, label?: string }
export function createBufferFromData(device, data, usage, options = {}) {
  const {
    mappedAtCreation = true,
    label = 'WebGPU Buffer'
  } = options;

  // バッファサイズの計算
  const buffer = device.createBuffer({
    size: data.byteLength,
    usage: usage,
    mappedAtCreation: mappedAtCreation,
    label: label
  });

  // データがある場合はバッファにコピー
  if (data) {
    const bufferView = new (data.constructor)(buffer.getMappedRange());
    bufferView.set(data);
    buffer.unmap();
  }

  return buffer;
}

// アニメーションループのセットアップ
export function setupAnimationLoop(callback) {
  function animate(currentTime) {
    requestAnimationFrame(animate);
    callback(currentTime);
  }
  
  requestAnimationFrame(animate);
}

// 形状インスタンス描画用のレンダラークラス
export class ShapeRenderer {
  #device;
  #context;
  #pipeline;
  #vertexBuffers = {};
  #numCircleSegments = 32;
  #dummyColorsBuffer;
  #uniformBuffer;

  constructor(device, context, format) {
    this.#device = device;
    this.#context = context;

    // すべての形状の頂点バッファを事前に作成
    this.#vertexBuffers['circle'] = this.#createVertexBuffer(this.#generateCircleVertices());
    this.#vertexBuffers['rectangle'] = this.#createVertexBuffer(this.#generateRectangleVertices());
    this.#vertexBuffers['line'] = this.#createVertexBuffer(this.#generateLineVertices());

    this.#uniformBuffer = this.#device.createBuffer({
      size: 48, // vec4f (radius + color + useColorBuffer + aspectRatio)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // 非常に小さな事前初期化のダミーcolorsバッファを作成
    this.#dummyColorsBuffer = device.createBuffer({
      size: 16, // 最小限のvec4f
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // 頂点シェーダーコード
    const vertexShaderCode = `
    struct VertexInput {
      @location(0) position: vec2f,
    }

    struct Uniforms {
      radius: f32,
      color: vec4f,
      useColorBuffer: f32,
      aspectRatio: f32,
    }

    struct VertexOutput {
      @builtin(position) position: vec4f,
      @location(0) color: vec4f,
    }

    @group(0) @binding(0) var<uniform> uniforms: Uniforms;
    @group(0) @binding(1) var<storage, read> centers: array<vec2f>;
    @group(0) @binding(2) var<storage, read> colors: array<vec4f>;

    @vertex
    fn main(
      vertex: VertexInput, 
      @builtin(instance_index) instanceIndex: u32
    ) -> VertexOutput {
      var output: VertexOutput;
      
      // アスペクト比を考慮した位置調整
      var adjustedPos = vertex.position;
      if (uniforms.aspectRatio > 0.0) {
        adjustedPos.x /= uniforms.aspectRatio;
      }
      
      // インスタンスの位置とスケールを適用
      let scaledPos = adjustedPos * uniforms.radius;
      let worldPos = scaledPos + centers[instanceIndex];
      
      output.position = vec4f(worldPos, 0.0, 1.0);
      
      // 色の選択
      if (uniforms.useColorBuffer == 1.0) {
        output.color = colors[instanceIndex];
      } else {
        output.color = uniforms.color;
      }
      
      return output;
    }
    `;

    // フラグメントシェーダーコード
    const fragmentShaderCode = `
    struct VertexOutput {
      @builtin(position) position: vec4f,
      @location(0) color: vec4f,
    }

    @fragment
    fn main(input: VertexOutput) -> @location(0) vec4f {
      return input.color;
    }
    `;

    // シェーダーモジュールの作成
    const vertexModule = device.createShaderModule({ code: vertexShaderCode });
    const fragmentModule = device.createShaderModule({ code: fragmentShaderCode });

    // レンダリングパイプラインの作成
    this.#pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: vertexModule,
        entryPoint: 'main',
        buffers: [
          // 頂点バッファ
          {
            arrayStride: 2 * 4, // vec2f
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: 'float32x2',
              }
            ]
          }
        ]
      },
      fragment: {
        module: fragmentModule,
        entryPoint: 'main',
        targets: [
          {
            format: format,
          }
        ]
      },
      primitive: {
        topology: 'triangle-list',
      }
    });
  }

  // 頂点バッファを作成するヘルパーメソッド
  #createVertexBuffer(vertices) {
    const buffer = this.#device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true
    });
    new Float32Array(buffer.getMappedRange()).set(vertices);
    buffer.unmap();
    return buffer;
  }

  // 円の頂点データを生成
  #generateCircleVertices() {
    const circleVertices = [];

    for (let i = 0; i < this.#numCircleSegments; i++) {
      const angle1 = (i / this.#numCircleSegments) * Math.PI * 2;
      const angle2 = ((i + 1) / this.#numCircleSegments) * Math.PI * 2;
      
      circleVertices.push(
        0, 0, // 中心点
        Math.cos(angle2), Math.sin(angle2),
        Math.cos(angle1), Math.sin(angle1),
      );
    }

    return new Float32Array(circleVertices);
  }

  // 四角形の頂点データを生成
  #generateRectangleVertices() {
    return new Float32Array([
      -0.5, -0.5,  // 左下
       0.5, -0.5,  // 右下
       0.5,  0.5,  // 右上
      -0.5,  0.5,  // 左上
      -0.5, -0.5,  // 左下（最初の点に戻る）
       0.5,  0.5   // 右上（三角形を作る）
    ]);
  }

  // 線分の頂点データを生成
  #generateLineVertices() {
    return new Float32Array([
      0, 0,  // 開始点
      1, 0   // 終了点
    ]);
  }

  // 形状を描画する内部メソッド
  #renderShapes(shapeType, centersBuffer, radius, color, instanceCount) {
    // コマンドエンコーダの作成
    const commandEncoder = this.#device.createCommandEncoder();

    // キャンバスのアスペクト比を計算
    const canvas = this.#context.canvas;
    const aspectRatio = canvas.width / canvas.height;

    // カラーバッファかどうかを判定
    const isColorBuffer = color instanceof GPUBuffer;

    // uniformバッファにデータを書き込む
    this.#device.queue.writeBuffer(
      this.#uniformBuffer, 
      0, 
      new Float32Array([
        radius, 0, 0, 0,  // radius (vec4fの最初の要素)
        isColorBuffer ? 1.0 : color[0],  // color
        isColorBuffer ? 1.0 : color[1],
        isColorBuffer ? 1.0 : color[2],
        isColorBuffer ? 1.0 : color[3],
        isColorBuffer ? 1 : 0,  // useColorBuffer
        aspectRatio, 0, 0
      ])
    );

    // バインドグループの作成
    const bindGroup = this.#device.createBindGroup({
      layout: this.#pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.#uniformBuffer } },
        { binding: 1, resource: { buffer: centersBuffer } },
        { 
          binding: 2, 
          resource: { 
            buffer: isColorBuffer ? color : this.#dummyColorsBuffer 
          } 
        }
      ]
    });

    // レンダーパスの開始
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.#context.getCurrentTexture().createView(),
        clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
        loadOp: 'load',
        storeOp: 'store'
      }]
    });

    renderPass.setPipeline(this.#pipeline);
    renderPass.setVertexBuffer(0, this.#vertexBuffers[shapeType]);
    renderPass.setBindGroup(0, bindGroup);
    const vertexCount = shapeType === 'circle' ? this.#numCircleSegments * 3 : 6;
    renderPass.draw(vertexCount, instanceCount, 0, 0);
    renderPass.end();

    // コマンドの実行
    this.#device.queue.submit([commandEncoder.finish()]);
  }

  // 円を描画するメソッド
  renderCircles(centersBuffer, radius, color, instanceCount) {
    this.#renderShapes('circle', centersBuffer, radius, color, instanceCount);
  }

  // 四角形を描画するメソッド
  renderRectangles(centersBuffer, size, color, instanceCount) {
    this.#renderShapes('rectangle', centersBuffer, size, color, instanceCount);
  }
}

export async function initDemo(demoInitFunction) {
  try {
    const canvas = document.getElementById('webgpu-canvas');
    if (!canvas) {
      throw new Error('キャンバス要素が見つかりません。');
    }

    const demoContainer = document.querySelector('.demo-container');
    canvas.width = demoContainer.clientWidth;
    canvas.height = 400;

    if (!navigator.gpu) {
      throw new Error('WebGPUはこのブラウザでサポートされていません。Chrome 113以降またはその他の対応ブラウザをお使いください。');
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('WebGPUアダプタが見つかりません。');
    }

    const device = await adapter.requestDevice();

    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format,
      alphaMode: 'premultiplied',
    });

    // ここで渡されたデモ初期化関数を呼び出す
    await demoInitFunction(device, context, canvas, format);

  } catch (error) {
    console.error('エラー:', error);

    const errorElement = document.getElementById('error-message');
    errorElement.textContent = `エラー: ${error.message}`;
    errorElement.style.display = 'block';

    const canvas = document.getElementById('webgpu-canvas');
    canvas.style.display = 'none';
  }
}
