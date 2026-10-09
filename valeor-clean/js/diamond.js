/* ===== diamond3d.js ===== */
(() => {
  const vertexShader = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute float aFacet;
    uniform float uAngle;
    uniform float uAspect;
    uniform float uOffset;
    uniform float uScale;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying float vFacet;

    vec3 rotateY(vec3 p, float a) {
      float c = cos(a), s = sin(a);
      return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
    }
    vec3 rotateX(vec3 p, float a) {
      float c = cos(a), s = sin(a);
      return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
    }
    void main() {
      vec3 p = rotateX(rotateY(aPosition, uAngle), -0.10);
      vec3 n = rotateX(rotateY(aNormal, uAngle), -0.10);
      p.y += 0.06;
      p.z -= 4.3;
      float lens = 3.15;
      gl_Position = vec4(((p.x * uScale) + uOffset) * lens / uAspect, p.y * uScale * lens, -p.z - 0.18, -p.z);
      vNormal = n;
      vPosition = p;
      vFacet = aFacet;
    }
  `;

  const fragmentShader = `
    precision highp float;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying float vFacet;
    uniform float uAngle;
    uniform float uAlpha;
    uniform float uGhost;

    void main() {
      vec3 n = normalize(vNormal);
      vec3 viewDir = normalize(-vPosition);
      vec3 key = normalize(vec3(-0.62, 0.90, 1.10));
      vec3 rimLight = normalize(vec3(0.95, 0.30, 0.50));
      vec3 fillLight = normalize(vec3(0.10, -0.75, 0.65));
      float diffuse = max(dot(n, key), 0.0);
      float secondary = max(dot(n, rimLight), 0.0);
      float fresnel = pow(1.0 - max(abs(dot(n, viewDir)), 0.0), 2.4);
      vec3 r = reflect(-viewDir, n);

      // reflejos tipo "softbox" de estudio: bandas claras/oscuras que cambian faceta a faceta
      float bands = 0.5 + 0.5 * sin(r.y * 6.2 + r.x * 3.1 + vFacet * 1.9 + uAngle * 0.9);
      bands = smoothstep(0.52, 0.94, bands);
      float softbox = pow(max(dot(r, key), 0.0), 5.0);
      float specular = pow(max(dot(reflect(-key, n), viewDir), 0.0), 90.0);
      float sharp = pow(max(dot(reflect(-rimLight, n), viewDir), 0.0), 150.0);
      float sparkle = pow(max(dot(reflect(-fillLight, n), viewDir), 0.0), 120.0);
      float twinkle = 0.5 + 0.5 * sin((n.x * 9.1 - n.y * 6.4 + n.z * 3.9) + uAngle * 2.6 + vFacet * 4.1);
      float fire = (sharp + sparkle * 0.8 + specular * 0.5) * (0.35 + twinkle * 0.65);

      // oro champagne: profundo -> oro medio -> oro claro (menos "bronce", más joya)
      vec3 deep = vec3(0.13, 0.082, 0.02);
      vec3 mid = vec3(0.90, 0.66, 0.24);
      vec3 light = vec3(1.0, 0.91, 0.60);
      vec3 white = vec3(1.0, 0.975, 0.90);
      vec3 cool = vec3(0.88, 0.95, 1.0);

      float facetTone = 0.68 + 0.32 * fract(sin(vFacet * 12.9898) * 43758.5453);
      vec3 color = mix(deep, mid, clamp(0.10 + diffuse * 0.70, 0.0, 1.0) * facetTone);
      color = mix(color, light, bands * 0.42 * (0.4 + diffuse));
      color += light * softbox * 0.38;
      color += mix(cool, white, twinkle) * fire * 1.7;
      color += white * specular * 1.05;
      color += mix(mid, light, secondary) * fresnel * 0.55;
      color += vec3(0.20, 0.13, 0.04) * (0.5 + 0.5 * n.y) * 0.20;
      if (uGhost > 0.5) color = mix(mid, light, bands) * (fresnel + specular * 0.6 + fire * 0.5 + 0.14);

      float alpha = uAlpha * (0.985 + fire * 0.015);
      gl_FragColor = vec4(color, alpha);
    }
  `;

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  function createProgram(gl) {
    const program = gl.createProgram();
    gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexShader));
    gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragmentShader));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    return program;
  }

  function createGeometry() {
    const positions = [], normals = [], facets = [];
    const sides = 16;
    const point = (radius, y, i, phase = 0) => {
      const angle = i / sides * Math.PI * 2 + phase;
      return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
    };
    const add = (a, b, c, facet) => {
      const ab = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
      const ac = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
      let n = [ab[1]*ac[2]-ab[2]*ac[1], ab[2]*ac[0]-ab[0]*ac[2], ab[0]*ac[1]-ab[1]*ac[0]];
      const length = Math.hypot(...n) || 1;
      n = n.map(v => v / length);
      const center=[(a[0]+b[0]+c[0])/3,(a[1]+b[1]+c[1])/3,(a[2]+b[2]+c[2])/3];
      if(n[0]*center[0]+n[1]*center[1]+n[2]*center[2]<0)n=n.map(v=>-v);
      positions.push(...a, ...b, ...c);
      normals.push(...n, ...n, ...n);
      facets.push(facet, facet, facet);
    };
    const table = Array.from({length:sides}, (_,i) => point(0.43, 0.68, i));
    const crown = Array.from({length:sides}, (_,i) => point(i % 2 ? 0.76 : 0.70, 0.38, i));
    const girdleTop = Array.from({length:sides}, (_,i) => point(1.0, 0.02, i));
    const girdleBottom = Array.from({length:sides}, (_,i) => point(0.985, -0.08, i));
    const pavilion = Array.from({length:sides}, (_,i) => point(i % 2 ? 0.61 : 0.67, -0.52, i));
    const top = [0, 0.70, 0], tip = [0, -1.16, 0];

    for (let i=0; i<sides; i++) {
      const j=(i+1)%sides, f=i+1;
      add(top, table[i], table[j], f);
      add(table[i], crown[i], crown[j], f+1);
      add(table[i], crown[j], table[j], f+2);
      add(crown[i], girdleTop[i], girdleTop[j], f+3);
      add(crown[i], girdleTop[j], crown[j], f+4);
      add(girdleTop[i], girdleBottom[i], girdleBottom[j], f+5);
      add(girdleTop[i], girdleBottom[j], girdleTop[j], f+6);
      add(girdleBottom[i], pavilion[i], pavilion[j], f+7);
      add(girdleBottom[i], pavilion[j], girdleBottom[j], f+8);
      add(pavilion[i], tip, pavilion[j], f+9);
    }
    return {positions:new Float32Array(positions), normals:new Float32Array(normals), facets:new Float32Array(facets)};
  }

  window.createAureonDiamond = canvas => {
    const gl = canvas.getContext('webgl', {alpha:true, antialias:true, premultipliedAlpha:false});
    if (!gl) return null;
    const program = createProgram(gl), geometry = createGeometry();
    gl.useProgram(program);
    const bind = (name, size, data) => {
      const location = gl.getAttribLocation(program, name), buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    };
    bind('aPosition',3,geometry.positions); bind('aNormal',3,geometry.normals); bind('aFacet',1,geometry.facets);
    const uniforms = Object.fromEntries(['uAngle','uAspect','uOffset','uScale','uAlpha','uGhost'].map(name => [name,gl.getUniformLocation(program,name)]));
    const history = Array.from({length:5}, () => 0);
    let lastAngle = 0;

    const resize = () => {
      const rect=canvas.getBoundingClientRect(), ratio=Math.min(devicePixelRatio || 1, 2);
      const width=Math.max(2,Math.round(rect.width*ratio)), height=Math.max(2,Math.round(rect.height*ratio));
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height}
      gl.viewport(0,0,width,height);
      return width/height;
    };
    const draw = (angle, alpha, ghost, offset, scale, aspect) => {
      gl.uniform1f(uniforms.uAngle, angle*Math.PI/180);
      gl.uniform1f(uniforms.uAspect, aspect); gl.uniform1f(uniforms.uOffset, offset);
      gl.uniform1f(uniforms.uScale, scale); gl.uniform1f(uniforms.uAlpha, alpha); gl.uniform1f(uniforms.uGhost, ghost);
      gl.drawArrays(gl.TRIANGLES,0,geometry.positions.length/3);
    };
    const render = (angle, velocity=0) => {
      const aspect=resize(), speed=Math.min(1,Math.abs(velocity)/5);
      if(Math.abs(angle-lastAngle)>.01){history.unshift(lastAngle);history.pop();lastAngle=angle}
      gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
      if(speed>.055) history.slice().reverse().forEach((oldAngle,i)=>{
        const age=(i+1)/history.length, direction=Math.sign(velocity)||1;
        draw(oldAngle, speed*(0.012+i*0.007), 1, -direction*age*0.014, 0.99-age*0.018, aspect);
      });
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      draw(angle,0.96,0,0,1,aspect);
    };
    return {render};
  };
})();
