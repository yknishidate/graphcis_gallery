
struct Uniforms {
    screenSize: vec2<f32>,
    deltaTime: f32,
    circleRadius: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read_write> centers: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read_write> velocities: array<vec2<f32>>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= arrayLength(&centers)) {
        return;
    }

    var center = centers[index];
    var velocity = velocities[index];

    // Update position
    center += velocity * uniforms.deltaTime;

    // Bounce off screen boundaries
    if (center.x - uniforms.circleRadius < -1.0 || 
        center.x + uniforms.circleRadius > 1.0) {
        center.x = clamp(center.x, -1.0 + uniforms.circleRadius, 1.0 - uniforms.circleRadius);
        velocity.x *= -1.0;
    }

    if (center.y - uniforms.circleRadius < -1.0 ||
        center.y + uniforms.circleRadius > 1.0) {
        center.y = clamp(center.y, -1.0 + uniforms.circleRadius, 1.0 - uniforms.circleRadius);
        velocity.y *= -1.0;
    }

    centers[index] = center;
    velocities[index] = velocity;
}
