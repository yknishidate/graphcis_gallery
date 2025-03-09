// グラデーションを生成するCompute Shader

// バインディンググループ0のバインディング0にテクスチャストレージを定義
@group(0) @binding(0) var outputTexture: texture_storage_2d<rgba8unorm, write>;
// 時間パラメータを追加
@group(0) @binding(1) var<uniform> time: f32;

// スレッドグループのサイズを定義（8x8）
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  // テクスチャのサイズを取得
  let dimensions = textureDimensions(outputTexture);
  
  // 現在の位置が有効範囲内かチェック
  if (global_id.x >= dimensions.x || global_id.y >= dimensions.y) {
    return;
  }
  
  // 正規化された座標（0.0〜1.0）を計算
  let normalized_x = f32(global_id.x) / f32(dimensions.x);
  let normalized_y = f32(global_id.y) / f32(dimensions.y);
  
  // 時間に基づいて変化する値を計算
  let t = sin(time * 0.001) * 0.5 + 0.5; // 0〜1の範囲で変化
  
  // グラデーションカラーを計算（時間によってアニメーション）
  let color = vec4<f32>(
    normalized_x * t + (1.0 - t) * (1.0 - normalized_x),  // 赤: 時間によって左右反転
    normalized_y,                                          // 緑: 上から下へ増加
    (sin(time * 0.002 + normalized_x * 6.28) * 0.5 + 0.5), // 青: 時間とX座標に基づいて波状に変化
    1.0                                                    // アルファ: 常に1.0（完全不透明）
  );
  
  // 計算した色をテクスチャに書き込み
  textureStore(outputTexture, global_id.xy, color);
}
