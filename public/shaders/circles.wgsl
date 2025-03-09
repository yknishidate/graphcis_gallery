struct Circle {
    position: vec2<f32>,
    velocity: vec2<f32>,
    radius: f32,
}

struct Uniforms {
    screenSize: vec2<f32>,
    deltaTime: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read_write> circles: array<Circle>;

@compute @workgroup_size(64)
fn update_circles(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= arrayLength(&circles)) {
        return;
    }

    var circle = circles[index];

    // Update position
    circle.position += circle.velocity * uniforms.deltaTime;

    // Bounce off screen boundaries
    if (circle.position.x - circle.radius < 0.0 || circle.position.x + circle.radius > uniforms.screenSize.x) {
        circle.velocity.x *= -1.0;
    }

    if (circle.position.y - circle.radius < 0.0 || circle.position.y + circle.radius > uniforms.screenSize.y) {
        circle.velocity.y *= -1.0;
    }

    circles[index] = circle;
}
