# Protótipo A — design acoplado

Protótipo de referência do Trabalho de Conclusão de Curso II de Érick Mello
Junior, no curso de Bacharelado em Sistemas de Informação do IFBA, Campus
Feira de Santana.

Este repositório implementa um CRM simples de restaurantes e insumos em
funções FaaS, seguindo o padrão que a literatura descreve como *Fat Lambda*
ou *Lambda Monolith*: cada função concentra, no próprio handler, a leitura do
evento, as regras de negócio, o acesso ao banco de dados por meio do SDK do
provedor de nuvem e a montagem da resposta HTTP.

O protótipo existe como instrumento de medida. Ele é comparado, nos mesmos
atributos de qualidade, com o protótipo equivalente implementado segundo os
princípios da Clean Architecture, disponível em
[prototipo-com-clean-architecture](https://github.com/erickmjr/prototipo-com-clean-architecture).

## Decisão de implementação

O código deste repositório não foi escrito mal de propósito. Não há duplicação
artificial, nomes ruins ou código morto. O que o caracteriza é exclusivamente a
ausência de fronteira entre regra de negócio e infraestrutura, e nada mais.
Essa disciplina é necessária para que a comparação entre os protótipos meça o
efeito da arquitetura, e não a qualidade do esforço empregado em cada lado.

Pelo mesmo motivo, este protótipo foi escrito antes do protótipo com Clean
Architecture, de modo que o raciocínio em camadas não influenciasse suas
decisões de design.

## Casos de uso

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/restaurantes` | Cria um restaurante |
| GET | `/restaurantes/{id}` | Consulta um restaurante |
| PATCH | `/restaurantes/{id}` | Edita dados cadastrais do restaurante |
| POST | `/restaurantes/{id}/insumos` | Adiciona um insumo ao restaurante |
| PATCH | `/insumos/{insumoId}` | Edita um insumo |

## Regras de negócio

O nome do restaurante deve ter entre 3 e 120 caracteres. O CNPJ deve conter 14
dígitos e não pode ser uma sequência de dígitos repetidos, e não é editável
após o cadastro. O e-mail é normalizado para caixa baixa. O telefone deve ter
10 ou 11 dígitos. Um restaurante inativo não pode ser editado nem receber
insumos.

Os insumos aceitam as unidades KG, L e UN, sendo que a unidade UN não admite
quantidade fracionada. O preço unitário é representado em centavos, como
inteiro, e deve ser maior que zero. O sistema deriva automaticamente o valor
total em estoque e a sinalização de estoque abaixo do mínimo.

## Execução

```bash
npm install
npm run build          # verificação de tipos
npm test               # testes unitários
npm run test:cov       # testes com relatório de cobertura
npm run metrica:acoplamento   # violações da regra de dependência
```

## Métricas coletadas

A cobertura de testes é gerada pelo Vitest em `coverage/`. A contagem de
violações da regra de dependência é produzida pelo dependency-cruiser,
configurado em `.dependency-cruiser.cjs` para reportar todo módulo que contenha
regra de negócio e importe diretamente o SDK do provedor de nuvem.
