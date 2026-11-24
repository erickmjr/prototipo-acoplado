#!/usr/bin/env node
/**
 * Coleta das métricas usadas na comparação entre os protótipos do TCC.
 *
 * Reproduz, de forma automatizada, os três indicadores definidos no projeto
 * de pesquisa: testabilidade, desacoplamento de infraestrutura e o esforço de
 * simulação exigido pelos testes.
 *
 * Execução: node scripts/coletar-metricas.mjs
 */
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = process.cwd();

// Módulos que contêm regra de negócio neste protótipo.
const CAMINHOS_DE_NEGOCIO = ["src/handlers"];

// Expressões que caracterizam uma linha dedicada a simular serviço externo.
const MARCAS_DE_SIMULACAO = [
  "aws-sdk-client-mock",
  "mockClient",
  "vi.mock(",
  "@aws-sdk/"
];

function listarArquivos(diretorio, sufixo) {
  const encontrados = [];
  for (const entrada of readdirSync(diretorio)) {
    const caminho = join(diretorio, entrada);
    if (statSync(caminho).isDirectory()) {
      encontrados.push(...listarArquivos(caminho, sufixo));
    } else if (caminho.endsWith(sufixo)) {
      encontrados.push(caminho);
    }
  }
  return encontrados;
}

function contarLinhasDeSimulacao() {
  const arquivos = listarArquivos(join(RAIZ, "tests"), ".ts");
  let linhasDeSimulacao = 0;
  let linhasDeTeste = 0;

  for (const arquivo of arquivos) {
    for (const linha of readFileSync(arquivo, "utf8").split("\n")) {
      if (linha.trim() === "") continue;
      linhasDeTeste += 1;
      if (MARCAS_DE_SIMULACAO.some((marca) => linha.includes(marca))) {
        linhasDeSimulacao += 1;
      }
    }
  }

  return { arquivos: arquivos.length, linhasDeTeste, linhasDeSimulacao };
}

function coberturaDaLogicaDeNegocio() {
  execSync("npx vitest run --coverage", { stdio: "ignore" });

  const resumo = JSON.parse(
    readFileSync(join(RAIZ, "coverage", "coverage-summary.json"), "utf8")
  );

  let cobertas = 0;
  let totais = 0;

  for (const [arquivo, dados] of Object.entries(resumo)) {
    if (arquivo === "total") continue;
    const relativo = arquivo.replace(`${RAIZ}/`, "");
    if (!CAMINHOS_DE_NEGOCIO.some((base) => relativo.startsWith(base))) continue;
    if (false) {
      continue; // interfaces não possuem código executável
    }
    cobertas += dados.lines.covered;
    totais += dados.lines.total;
  }

  return {
    linhasCobertas: cobertas,
    linhasTotais: totais,
    percentual: totais === 0 ? 0 : Number(((cobertas / totais) * 100).toFixed(2))
  };
}

function violacoesDaRegraDeDependencia() {
  try {
    execSync("npx depcruise src --config .dependency-cruiser.cjs --output-type json", {
      stdio: ["ignore", "pipe", "ignore"]
    });
  } catch (erro) {
    const saida = erro.stdout?.toString() ?? "{}";
    const relatorio = JSON.parse(saida);
    return relatorio.summary?.error ?? 0;
  }

  const saida = execSync(
    "npx depcruise src --config .dependency-cruiser.cjs --output-type json",
    { stdio: ["ignore", "pipe", "ignore"] }
  ).toString();

  return JSON.parse(saida).summary?.error ?? 0;
}

const simulacao = contarLinhasDeSimulacao();
const cobertura = coberturaDaLogicaDeNegocio();
const violacoes = violacoesDaRegraDeDependencia();

console.log("Métricas do protótipo\n");
console.log("Testabilidade");
console.log(
  `  Cobertura da lógica de negócio: ${cobertura.percentual}% ` +
    `(${cobertura.linhasCobertas} de ${cobertura.linhasTotais} linhas)`
);
console.log(
  `  Linhas dedicadas a simular serviços externos: ${simulacao.linhasDeSimulacao}`
);
console.log(
  `  Proporção sobre o total de linhas de teste: ` +
    `${((simulacao.linhasDeSimulacao / simulacao.linhasDeTeste) * 100).toFixed(2)}% ` +
    `(${simulacao.linhasDeTeste} linhas em ${simulacao.arquivos} arquivos)`
);
console.log("\nDesacoplamento de infraestrutura");
console.log(`  Violações da regra de dependência: ${violacoes}`);
