/**
 * Configuração usada para medir o atributo "desacoplamento de infraestrutura".
 *
 * A regra abaixo verifica se existe algum módulo que contenha regra de negócio
 * e que, ao mesmo tempo, importe diretamente o SDK do provedor de nuvem.
 *
 * Neste protótipo a regra é intencionalmente violada: as regras de negócio
 * vivem dentro dos próprios handlers, que importam o SDK da AWS diretamente.
 * O número de violações reportadas é um dos dados coletados pela pesquisa.
 */
module.exports = {
  forbidden: [
    {
      name: "regra-de-negocio-sem-sdk",
      comment:
        "Módulos que contêm regra de negócio não devem importar o SDK do provedor de nuvem.",
      severity: "error",
      from: { path: "^src/handlers" },
      to: { path: "^node_modules/@aws-sdk" }
    },
    {
      name: "sem-dependencia-circular",
      severity: "error",
      from: {},
      to: { circular: true }
    }
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    reporterOptions: {
      dot: { collapsePattern: "node_modules/(@[^/]+/[^/]+|[^/]+)" }
    }
  }
};
