let creatures = [];
let food = [];
let history = [];
let running = true;
let generation = 1;
let sketchHost;
let controls;

const MAX_CREATURES = 260;
const MAX_FOOD = 620;
const START_CREATURES = 42;
const START_FOOD = 210;

function setup() {
  sketchHost = document.getElementById("sketch");
  const canvas = createCanvas(sketchHost.clientWidth, sketchHost.clientHeight);
  canvas.parent("sketch");
  colorMode(HSB, 360, 100, 100, 100);
  pixelDensity(1);
  controls = bindControls();
  resetWorld();
}

function draw() {
  background(156, 16, 8);
  drawFoodGlow();

  if (running) {
    for (let step = 0; step < Number(controls.simSpeed.value); step++) {
      tickWorld();
    }
  }

  drawFood();
  drawCreatures();
  drawTrails();
  updateStats();
}

function windowResized() {
  resizeCanvas(sketchHost.clientWidth, sketchHost.clientHeight);
}

function bindControls() {
  const bound = {
    foodGrowth: document.getElementById("food-growth"),
    mutation: document.getElementById("mutation"),
    metabolism: document.getElementById("metabolism"),
    simSpeed: document.getElementById("sim-speed"),
    toggle: document.getElementById("toggle"),
    seed: document.getElementById("seed"),
    reset: document.getElementById("reset")
  };

  bound.toggle.addEventListener("click", () => {
    running = !running;
    bound.toggle.textContent = running ? "Pause" : "Run";
  });

  bound.seed.addEventListener("click", () => {
    for (let i = 0; i < 16; i++) {
      creatures.push(new Creature(random(width), random(height)));
    }
  });

  bound.reset.addEventListener("click", resetWorld);
  return bound;
}

function resetWorld() {
  generation = 1;
  creatures = [];
  food = [];
  history = [];

  for (let i = 0; i < START_CREATURES; i++) {
    creatures.push(new Creature(random(width), random(height)));
  }

  for (let i = 0; i < START_FOOD; i++) {
    food.push(new Food(random(width), random(height)));
  }
}

function tickWorld() {
  growFood();

  for (let i = creatures.length - 1; i >= 0; i--) {
    const creature = creatures[i];
    creature.update();
    creature.eat(food);

    if (creature.energy > creature.reproductionEnergy && creatures.length < MAX_CREATURES) {
      creatures.push(creature.reproduce());
      generation = max(generation, creature.generation + 1);
    }

    if (creature.energy <= 0 || creature.age > creature.maxAge) {
      creatures.splice(i, 1);
    }
  }

  if (creatures.length < 8) {
    for (let i = 0; i < 6; i++) {
      creatures.push(new Creature(random(width), random(height)));
    }
  }

  if (frameCount % 12 === 0) {
    history.push(creatures.length);
    if (history.length > 160) history.shift();
  }
}

function growFood() {
  const growth = Number(controls.foodGrowth.value);
  if (food.length >= MAX_FOOD) return;

  for (let i = 0; i < growth; i++) {
    if (random() < 0.28) {
      const parent = random(food);
      if (parent) {
        food.push(new Food(parent.pos.x + random(-48, 48), parent.pos.y + random(-48, 48)));
      } else {
        food.push(new Food(random(width), random(height)));
      }
    }
  }
}

function drawFoodGlow() {
  noStroke();
  for (const pellet of food) {
    fill(116, 70, 42, 5);
    circle(pellet.pos.x, pellet.pos.y, pellet.energy * 5);
  }
}

function drawFood() {
  noStroke();
  for (const pellet of food) {
    fill(118, 64, 82, 82);
    circle(pellet.pos.x, pellet.pos.y, pellet.energy * 1.35);
  }
}

function drawCreatures() {
  for (const creature of creatures) {
    creature.draw();
  }
}

function drawTrails() {
  if (history.length < 2) return;

  const w = min(220, width * 0.28);
  const h = 58;
  const x = 20;
  const y = height - h - 20;
  const peak = max(START_CREATURES, ...history);

  noFill();
  stroke(45, 55, 90, 68);
  strokeWeight(2);
  beginShape();
  for (let i = 0; i < history.length; i++) {
    const px = map(i, 0, history.length - 1, x, x + w);
    const py = map(history[i], 0, peak, y + h, y);
    vertex(px, py);
  }
  endShape();
}

function updateStats() {
  const avgLength = creatures.length
    ? creatures.reduce((sum, creature) => sum + creature.bodyLength(), 0) / creatures.length
    : 0;

  document.getElementById("population").textContent = creatures.length;
  document.getElementById("food-count").textContent = food.length;
  document.getElementById("generation").textContent = generation;
  document.getElementById("avg-length").textContent = avgLength.toFixed(1);
}

class Food {
  constructor(x, y) {
    this.pos = createVector(wrapValue(x, width), wrapValue(y, height));
    this.energy = random(5, 10);
  }
}

class Creature {
  constructor(x, y, genes = null, generationNumber = 1) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(0.4, 1.5));
    this.acc = createVector(0, 0);
    this.age = 0;
    this.generation = generationNumber;

    this.genes = genes || {
      speed: random(0.85, 2.55),
      sense: random(48, 140),
      size: random(4.2, 8.8),
      length: random(2.1, 4.9),
      width: random(1.15, 2.35),
      head: random(0.55, 1.55),
      tail: random(0.25, 1.75),
      eyeGap: random(0.22, 0.72),
      sensorWidth: random(0.09, 0.36),
      markings: random(0.1, 1),
      hue: random([15, 42, 196, 286]) + random(-14, 14),
      efficiency: random(0.72, 1.2),
      turn: random(0.035, 0.13)
    };

    this.energy = 55;
    this.reproductionEnergy = 92 + this.genes.size * 4;
    this.maxAge = random(1900, 3100) * this.genes.efficiency;
  }

  update() {
    this.age++;
    const metabolism = Number(controls.metabolism.value) / 1000;
    const speedCost = this.genes.speed * 0.014;
    const shapeCost = this.bodyLength() * 0.0009 + this.bodyWidth() * 0.0012;
    const sensorCost = this.genes.sense * this.genes.sensorWidth * 0.00008;
    const sizeCost = this.genes.size * 0.0025 + shapeCost + sensorCost;
    this.energy -= (metabolism + speedCost + sizeCost) / this.genes.efficiency;

    const target = this.nearestFood();
    if (target) {
      const desired = p5.Vector.sub(target.pos, this.pos).setMag(this.genes.speed);
      this.acc.add(p5.Vector.sub(desired, this.vel).limit(this.genes.turn));
    } else {
      this.acc.add(p5.Vector.random2D().mult(0.045));
    }

    this.separate();
    this.vel.add(this.acc).limit(this.genes.speed);
    this.pos.add(this.vel);
    this.acc.mult(0);
    this.wrap();
  }

  nearestFood() {
    let best = null;
    let bestDistance = this.genes.sense;

    for (const pellet of food) {
      const distance = torusDistance(this.pos, pellet.pos);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = pellet;
      }
    }

    return best;
  }

  separate() {
    const desiredGap = this.bodyLength() * 0.82;
    const push = createVector(0, 0);
    let neighbors = 0;

    for (const other of creatures) {
      if (other === this) continue;
      const distance = torusDistance(this.pos, other.pos);
      if (distance > 0 && distance < desiredGap) {
        push.add(p5.Vector.sub(this.pos, other.pos).normalize().div(distance));
        neighbors++;
      }
    }

    if (neighbors > 0) {
      push.div(neighbors).setMag(this.genes.speed).sub(this.vel).limit(0.065);
      this.acc.add(push);
    }
  }

  eat(foodList) {
    for (let i = foodList.length - 1; i >= 0; i--) {
      const pellet = foodList[i];
      if (torusDistance(this.pos, pellet.pos) < this.bodyWidth() * 0.58 + pellet.energy * 0.55) {
        this.energy += pellet.energy * 1.9;
        foodList.splice(i, 1);
        if (this.energy > 150) this.energy = 150;
        return;
      }
    }
  }

  reproduce() {
    this.energy *= 0.48;
    const childGenes = mutateGenes(this.genes);
    const offset = p5.Vector.random2D().mult(this.bodyLength() * 0.65);
    return new Creature(
      wrapValue(this.pos.x + offset.x, width),
      wrapValue(this.pos.y + offset.y, height),
      childGenes,
      this.generation + 1
    );
  }

  draw() {
    const angle = this.vel.heading();
    const energyAlpha = map(this.energy, 0, 140, 38, 96, true);
    const bodyHue = wrapValue(this.genes.hue, 360);
    const length = this.bodyLength();
    const bodyWidth = this.bodyWidth();
    const headSize = bodyWidth * this.genes.head;
    const tailLength = this.genes.size * this.genes.tail;
    const eyeSize = max(1.9, bodyWidth * 0.16);
    const eyeY = bodyWidth * this.genes.eyeGap * 0.5;

    push();
    translate(this.pos.x, this.pos.y);
    rotate(angle);
    noStroke();
    fill(bodyHue, 68, 94, 18);
    arc(0, 0, this.genes.sense * 0.58, this.genes.sense * this.genes.sensorWidth, -0.58, 0.58);

    fill(bodyHue, 70, 62, energyAlpha * 0.58);
    triangle(
      -length * 0.48,
      0,
      -length * 0.5 - tailLength,
      -bodyWidth * 0.34,
      -length * 0.5 - tailLength,
      bodyWidth * 0.34
    );

    fill(bodyHue, 74, 96, energyAlpha);
    ellipse(-length * 0.06, 0, length, bodyWidth);

    fill(wrapValue(bodyHue + 18, 360), 62, 100, energyAlpha);
    ellipse(length * 0.38, 0, headSize, bodyWidth * 0.9);

    if (this.genes.markings > 0.28) {
      fill(wrapValue(bodyHue + 150, 360), 54, 96, 32 + this.genes.markings * 34);
      ellipse(-length * 0.2, 0, length * 0.18, bodyWidth * 0.7);
    }

    if (this.genes.markings > 0.62) {
      stroke(wrapValue(bodyHue + 210, 360), 46, 100, 46);
      strokeWeight(max(1, bodyWidth * 0.07));
      line(-length * 0.42, -bodyWidth * 0.12, length * 0.2, -bodyWidth * 0.22);
      line(-length * 0.42, bodyWidth * 0.12, length * 0.2, bodyWidth * 0.22);
      noStroke();
    }

    fill(0, 0, 100, 90);
    circle(length * 0.43, -eyeY, eyeSize);
    circle(length * 0.43, eyeY, eyeSize);
    pop();
  }

  bodyLength() {
    return this.genes.size * this.genes.length;
  }

  bodyWidth() {
    return this.genes.size * this.genes.width;
  }

  wrap() {
    this.pos.x = wrapValue(this.pos.x, width);
    this.pos.y = wrapValue(this.pos.y, height);
  }
}

function mutateGenes(genes) {
  const rate = Number(controls.mutation.value) / 100;
  return {
    speed: constrain(genes.speed + randomGaussian(0, 0.22 * rate), 0.45, 3.8),
    sense: constrain(genes.sense + randomGaussian(0, 18 * rate), 28, 190),
    size: constrain(genes.size + randomGaussian(0, 0.9 * rate), 3.2, 11.5),
    length: constrain(genes.length + randomGaussian(0, 0.7 * rate), 1.25, 6.5),
    width: constrain(genes.width + randomGaussian(0, 0.32 * rate), 0.72, 3.1),
    head: constrain(genes.head + randomGaussian(0, 0.28 * rate), 0.3, 2.0),
    tail: constrain(genes.tail + randomGaussian(0, 0.42 * rate), 0.0, 2.6),
    eyeGap: constrain(genes.eyeGap + randomGaussian(0, 0.16 * rate), 0.06, 1.05),
    sensorWidth: constrain(genes.sensorWidth + randomGaussian(0, 0.09 * rate), 0.04, 0.58),
    markings: constrain(genes.markings + randomGaussian(0, 0.28 * rate), 0, 1),
    hue: wrapValue(genes.hue + randomGaussian(0, 28 * rate), 360),
    efficiency: constrain(genes.efficiency + randomGaussian(0, 0.12 * rate), 0.48, 1.55),
    turn: constrain(genes.turn + randomGaussian(0, 0.03 * rate), 0.02, 0.18)
  };
}

function torusDistance(a, b) {
  const dx = abs(a.x - b.x);
  const dy = abs(a.y - b.y);
  return sqrt(sq(min(dx, width - dx)) + sq(min(dy, height - dy)));
}

function wrapValue(value, maxValue) {
  return ((value % maxValue) + maxValue) % maxValue;
}
