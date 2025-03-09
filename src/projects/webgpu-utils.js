// WebGPU ユーティリティ関数

// フルスクリーン四角形描画用のレンダラークラス
export class FullscreenQuadRenderer {
  // プライベート変数
  #device;
  #format;
  #pipeline;
  #bindGroupLayout;
  #sampler;
  
  // コンストラクタ
  constructor(device, format, canvas) {
    this.#device = device;
    this.#format = format;
    
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
    @group(0) @binding(0) var textureSampler: sampler;
    @group(0) @binding(1) var textureData: texture_2d<f32>;

    @fragment
    fn main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
      let texCoord = vec2f(fragCoord.x / ${canvas.width}.0, 1.0 - fragCoord.y / ${canvas.height}.0);
      return textureSample(textureData, textureSampler, texCoord);
    }
    `;
    
    // シェーダーモジュールを作成
    const vertexModule = createShaderModule(device, vertexShaderCode);
    const fragmentModule = createShaderModule(device, fragmentShaderCode);
    
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
  
  // キャンバスサイズが変更された場合に再初期化
  resize(canvas) {
    // 新しいレンダラーを作成して内部状態を更新
    const newRenderer = new FullscreenQuadRenderer(this.#device, this.#format, canvas);
    this.#pipeline = newRenderer.#pipeline;
    this.#bindGroupLayout = newRenderer.#bindGroupLayout;
    this.#sampler = newRenderer.#sampler;
  }
  
  // テクスチャをフルスクリーンで描画
  render(context, texture, clearColor = { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }) {
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
    submitCommands(this.#device, commandEncoder);
  }
}

// WebGPUデバイスの初期化
export async function initWebGPU(canvas) {
  // WebGPUがサポートされているか確認
  if (!navigator.gpu) {
    throw new Error('WebGPUはこのブラウザでサポートされていません。');
  }

  // アダプタの要求
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error('WebGPUアダプタが見つかりません。');
  }

  // デバイスの要求
  const device = await adapter.requestDevice();

  // キャンバスのコンテキストを設定
  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format,
    alphaMode: 'premultiplied',
  });

  return { device, context, format };
}

// シェーダーファイルの読み込み
export async function loadShader(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`シェーダーファイル ${path} の読み込みに失敗しました。`);
  }
  return await response.text();
}

// シェーダーモジュールの作成
export function createShaderModule(device, code) {
  return device.createShaderModule({
    code: code,
  });
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

// コマンドの実行
export function submitCommands(device, commandEncoder) {
  const commandBuffer = commandEncoder.finish();
  device.queue.submit([commandBuffer]);
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
  #format;
  #pipeline;
  #bindGroupLayout;
  #vertexBuffer;
  #shapeType;
  #numCircleSegments = 32;
  #dummyColorsBuffer;
  #uniformBuffer;

  constructor(device, context, format, shapeType = 'circle') {
    this.#device = device;
    this.#context = context;
    this.#format = format;
    this.#shapeType = shapeType;

    // 形状の頂点データを生成
    const vertices = this.#generateShapeVertices(shapeType);

    this.#uniformBuffer = this.#device.createBuffer({
      size: 48, // vec4f (radius + color + useColorBuffer + aspectRatio)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    
    // 頂点バッファの作成
    this.#vertexBuffer = device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true
    });
    new Float32Array(this.#vertexBuffer.getMappedRange()).set(vertices);
    this.#vertexBuffer.unmap();

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
    const vertexModule = createShaderModule(device, vertexShaderCode);
    const fragmentModule = createShaderModule(device, fragmentShaderCode);

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

  // 形状の頂点データを生成
  #generateShapeVertices(shapeType) {
    switch(shapeType) {
      case 'circle':
        // 円のメッシュ（三角形リスト）
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

      case 'rectangle':
        // 四角形の頂点
        return new Float32Array([
          -0.5, -0.5,  // 左下
           0.5, -0.5,  // 右下
           0.5,  0.5,  // 右上
          -0.5,  0.5,  // 左上
          -0.5, -0.5,  // 左下（最初の点に戻る）
           0.5,  0.5   // 右上（三角形を作る）
        ]);

      case 'line':
        // 線分
        return new Float32Array([
          0, 0,  // 開始点
          1, 0   // 終了点
        ]);

      default:
        throw new Error(`サポートされていない形状: ${shapeType}`);
    }
  }

  // 単一色の円を描画するメソッド
  renderCircles(centersBuffer, radius, color, instanceCount) {
    // コマンドエンコーダの作成
    const commandEncoder = this.#device.createCommandEncoder();

    // キャンバスのアスペクト比を計算
    const canvas = this.#context.canvas;
    const aspectRatio = canvas.width / canvas.height;

    // uniformバッファにデータを書き込む
    this.#device.queue.writeBuffer(
      this.#uniformBuffer, 
      0, 
      new Float32Array([
        radius, 0, 0, 0,  // radius (vec4fの最初の要素)
        color[0], color[1], color[2], color[3],  // color
        0, aspectRatio, 0, 0,  // useColorBuffer (0 = false)
      ])
    );

    // バインドグループの作成
    const bindGroup = this.#device.createBindGroup({
      layout: this.#pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.#uniformBuffer } },
        { binding: 1, resource: { buffer: centersBuffer } },
        { binding: 2, resource: { buffer: this.#dummyColorsBuffer } }
      ]
    });

    // レンダーパスの開始
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.#context.getCurrentTexture().createView(),
        clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });

    renderPass.setPipeline(this.#pipeline);
    renderPass.setVertexBuffer(0, this.#vertexBuffer);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(this.#numCircleSegments * 3, instanceCount, 0, 0);
    renderPass.end();

    this.#device.queue.submit([commandEncoder.finish()]);
  }

  // カラーバッファを使用して円を描画するメソッド
  renderCirclesWithColorBuffer(centersBuffer, colorsBuffer, radius, instanceCount) {
    // コマンドエンコーダの作成
    const commandEncoder = this.#device.createCommandEncoder();

    // キャンバスのアスペクト比を計算
    const canvas = this.#context.canvas;
    const aspectRatio = canvas.width / canvas.height;

    // uniformバッファにデータを書き込む
    this.#device.queue.writeBuffer(
      this.#uniformBuffer, 
      0, 
      new Float32Array([
        radius, 0, 0, 0,  // radius (vec4fの最初の要素)
        1.0, 1.0, 1.0, 1.0,  // デフォルトカラー（使用されない）
        1, aspectRatio, 0, 0,  // useColorBuffer (1 = true)
      ])
    );

    // バインドグループの作成
    const bindGroup = this.#device.createBindGroup({
      layout: this.#pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.#uniformBuffer } },
        { binding: 1, resource: { buffer: centersBuffer } },
        { binding: 2, resource: { buffer: colorsBuffer } }
      ]
    });

    // レンダーパスの開始
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.#context.getCurrentTexture().createView(),
        clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });

    renderPass.setPipeline(this.#pipeline);
    renderPass.setVertexBuffer(0, this.#vertexBuffer);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(this.#numCircleSegments * 3, instanceCount, 0, 0);
    renderPass.end();

    // コマンドの実行
    this.#device.queue.submit([commandEncoder.finish()]);
  }
}
