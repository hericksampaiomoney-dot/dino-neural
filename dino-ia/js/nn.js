class NeuralNet {
  constructor(sizes, weights) {
    this.sizes = sizes;
    this.weights = weights ?? NeuralNet.randomWeights(sizes);
  }

  static random(sizes) {
    return new NeuralNet(sizes);
  }

  static randomWeights(sizes) {
    const weights = [];
    for (let l = 1; l < sizes.length; l++) {
      const rows = sizes[l];
      const cols = sizes[l - 1] + 1;
      const layer = new Float32Array(rows * cols);
      const scale = Math.sqrt(2 / cols);
      for (let i = 0; i < layer.length; i++) {
        layer[i] = NeuralNet.randn() * scale;
      }
      weights.push(layer);
    }
    return weights;
  }

  static randn() {
    const u = 1 - Math.random();
    const v = 1 - Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  activations(inputs) {
    const layers = [Float32Array.from(inputs)];
    let act = layers[0];
    for (let l = 0; l < this.weights.length; l++) {
      const w = this.weights[l];
      const inSize = this.sizes[l];
      const outSize = this.sizes[l + 1];
      const next = new Float32Array(outSize);
      const last = l === this.weights.length - 1;
      for (let o = 0; o < outSize; o++) {
        let sum = w[o * (inSize + 1) + inSize];
        for (let i = 0; i < inSize; i++) sum += w[o * (inSize + 1) + i] * act[i];
        next[o] = last ? 1 / (1 + Math.exp(-sum)) : Math.tanh(sum);
      }
      layers.push(next);
      act = next;
    }
    return layers;
  }

  predict(inputs) {
    const layers = this.activations(inputs);
    return layers[layers.length - 1];
  }

  decide(inputs) {
    const [jump, duck] = this.predict(inputs);
    if (jump > duck && jump > 0.55) return "jump";
    if (duck > 0.55) return "duck";
    return "run";
  }

  clone() {
    return new NeuralNet(
      this.sizes.slice(),
      this.weights.map((w) => new Float32Array(w))
    );
  }

  mutate(rate = 0.12, scale = 0.35) {
    for (const layer of this.weights) {
      for (let i = 0; i < layer.length; i++) {
        if (Math.random() < rate) layer[i] += NeuralNet.randn() * scale;
        if (Math.random() < rate * 0.05) layer[i] = NeuralNet.randn() * 0.5;
      }
    }
    return this;
  }

  static crossover(a, b) {
    const child = a.clone();
    for (let l = 0; l < child.weights.length; l++) {
      const aw = a.weights[l];
      const bw = b.weights[l];
      const cw = child.weights[l];
      for (let i = 0; i < cw.length; i++) {
        cw[i] = Math.random() < 0.5 ? aw[i] : bw[i];
      }
    }
    return child;
  }

  toJSON() {
    return {
      sizes: this.sizes,
      weights: this.weights.map((w) => Array.from(w)),
    };
  }

  static fromJSON(data) {
    return new NeuralNet(
      data.sizes,
      data.weights.map((w) => Float32Array.from(w))
    );
  }
}

const NET_SIZES = [6, 8, 2];
