const POP_SIZE = 80;

function newPopulation(seedBrain = null) {
  const population = Array.from({ length: POP_SIZE }, () => new Dino(NeuralNet.random(NET_SIZES)));
  if (seedBrain) {
    const seededCount = Math.max(2, Math.floor(POP_SIZE * 0.2));
    population[0] = new Dino(seedBrain.clone());
    for (let i = 1; i < seededCount; i++) {
      population[i] = new Dino(seedBrain.clone().mutate(0.2, 0.32));
    }
  }
  return population;
}

function nextGeneration(dinos) {
  const ranked = dinos.slice().sort((a, b) => b.fitness - a.fitness);
  const elites = ranked.slice(0, 4);
  const next = elites.map((d) => new Dino(d.brain.clone()));

  while (next.length < POP_SIZE) {
    const a = pick(ranked);
    const b = pick(ranked);
    const brain = NeuralNet.crossover(a.brain, b.brain).mutate(
      0.14,
      0.28 + Math.random() * 0.2
    );
    next.push(new Dino(brain));
  }
  return { population: next, best: elites[0] };
}

function pick(ranked) {
  const top = ranked.slice(0, Math.max(8, (ranked.length * 0.3) | 0));
  const weights = top.map((_, i) => top.length - i);
  let r = Math.random() * weights.reduce((s, n) => s + n, 0);
  for (let i = 0; i < top.length; i++) {
    r -= weights[i];
    if (r <= 0) return top[i];
  }
  return top[0];
}
