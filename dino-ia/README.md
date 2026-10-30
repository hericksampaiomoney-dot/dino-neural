# Dino IA

Jogo no estilo do dino do Chrome, em HTML/Canvas, treinado com uma rede neural pequena e algoritmo genético.

## Como abrir

Abra `index.html` no navegador (dois cliques). Não precisa de servidor nem de instalação.

- **Treinar população**: 80 dinos ao mesmo tempo, mesma pista.
- **Ver campeão**: a melhor rede salva no `localStorage`.
- **Jogar você**: espaço / ↑ pula, ↓ agacha.
- **Velocidade**: ajuste contínuo de 0,5x a 20x.
- **Obstáculos**: escolha a proporção de cactos e pássaros; os dois valores somam 100%.
- **Salvar rede**: exporta o melhor indivíduo num arquivo JSON.
- **Carregar rede**: valida um JSON e inicia uma nova espécie com a rede importada e descendentes mutantes.

## Rede

- Arquitetura `6 → 8 → 2`
- Entradas: distância, altura e largura do próximo obstáculo, se é pássaro, altura do dino, velocidade
- Saídas: pular e agachar
- Evolução: elitismo + cruzamento + mutação
- Arquivos importados precisam manter a arquitetura `6 → 8 → 2`.
