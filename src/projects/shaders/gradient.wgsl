@group(0) @binding(0) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var<uniform> time: f32;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let dimensions = textureDimensions(outputTexture);
  
  if (global_id.x >= dimensions.x || global_id.y >= dimensions.y) {
    return;
  }
  
  let normalized_x = f32(global_id.x) / f32(dimensions.x);
  let normalized_y = f32(global_id.y) / f32(dimensions.y);
  
  let t = sin(time * 0.001) * 0.5 + 0.5;
  
  let color = vec4<f32>(
    normalized_x * t + (1.0 - t) * (1.0 - normalized_x),
    normalized_y,
    (sin(time * 0.002 + normalized_x * 6.28) * 0.5 + 0.5),
    1.0
  );
  
  textureStore(outputTexture, global_id.xy, color);
}
