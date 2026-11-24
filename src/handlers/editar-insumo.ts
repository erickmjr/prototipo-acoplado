import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand
} from "@aws-sdk/lib-dynamodb";

const cliente = new DynamoDBClient({});
const documento = DynamoDBDocumentClient.from(cliente);
const TABELA_INSUMOS = process.env.TABELA_INSUMOS ?? "insumos";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const insumoId = event.pathParameters?.insumoId;

  if (!insumoId) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        codigo: "REQUISICAO_INVALIDA",
        mensagem: "O identificador do insumo não foi informado."
      })
    };
  }

  let corpo: Record<string, unknown>;

  try {
    corpo = JSON.parse(event.body ?? "");
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({
        codigo: "REQUISICAO_INVALIDA",
        mensagem: "Corpo da requisição não é um JSON válido."
      })
    };
  }

  const resultado = await documento.send(
    new GetCommand({ TableName: TABELA_INSUMOS, Key: { id: insumoId } })
  );

  if (!resultado.Item) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        codigo: "INSUMO_NAO_ENCONTRADO",
        mensagem: "Insumo não encontrado."
      })
    };
  }

  const atual = resultado.Item as Record<string, unknown>;
  const alteracoes: Record<string, unknown> = {};

  if ("nome" in corpo) {
    const nome = typeof corpo.nome === "string" ? corpo.nome.trim() : "";
    if (nome.length < 2 || nome.length > 80) {
      return {
        statusCode: 422,
        body: JSON.stringify({
          codigo: "NOME_INVALIDO",
          mensagem: "O nome do insumo deve ter entre 2 e 80 caracteres."
        })
      };
    }
    alteracoes.nome = nome;
  }

  if ("quantidade" in corpo) {
    const quantidade = Number(corpo.quantidade);
    if (!Number.isFinite(quantidade) || quantidade < 0) {
      return {
        statusCode: 422,
        body: JSON.stringify({
          codigo: "QUANTIDADE_INVALIDA",
          mensagem: "A quantidade deve ser um número maior ou igual a zero."
        })
      };
    }
    if (atual.unidade === "UN" && !Number.isInteger(quantidade)) {
      return {
        statusCode: 422,
        body: JSON.stringify({
          codigo: "QUANTIDADE_INVALIDA",
          mensagem: "Insumos medidos em unidade não aceitam quantidade fracionada."
        })
      };
    }
    alteracoes.quantidade = quantidade;
  }

  if ("precoUnitarioCentavos" in corpo) {
    const preco = Number(corpo.precoUnitarioCentavos);
    if (!Number.isInteger(preco) || preco <= 0) {
      return {
        statusCode: 422,
        body: JSON.stringify({
          codigo: "PRECO_INVALIDO",
          mensagem: "O preço unitário deve ser um inteiro de centavos maior que zero."
        })
      };
    }
    alteracoes.precoUnitarioCentavos = preco;
  }

  if ("estoqueMinimo" in corpo) {
    const estoqueMinimo = Number(corpo.estoqueMinimo);
    if (!Number.isFinite(estoqueMinimo) || estoqueMinimo < 0) {
      return {
        statusCode: 422,
        body: JSON.stringify({
          codigo: "ESTOQUE_MINIMO_INVALIDO",
          mensagem: "O estoque mínimo deve ser um número maior ou igual a zero."
        })
      };
    }
    alteracoes.estoqueMinimo = estoqueMinimo;
  }

  if (Object.keys(alteracoes).length === 0) {
    return {
      statusCode: 422,
      body: JSON.stringify({
        codigo: "NENHUMA_ALTERACAO",
        mensagem: "Nenhum campo editável foi informado."
      })
    };
  }

  const quantidadeFinal = Number(alteracoes.quantidade ?? atual.quantidade);
  const precoFinal = Number(
    alteracoes.precoUnitarioCentavos ?? atual.precoUnitarioCentavos
  );
  const estoqueMinimoFinal = Number(
    alteracoes.estoqueMinimo ?? atual.estoqueMinimo
  );

  const atualizado = {
    ...atual,
    ...alteracoes,
    abaixoDoMinimo: quantidadeFinal < estoqueMinimoFinal,
    valorTotalCentavos: Math.round(quantidadeFinal * precoFinal),
    atualizadoEm: new Date().toISOString()
  };

  await documento.send(
    new PutCommand({ TableName: TABELA_INSUMOS, Item: atualizado })
  );

  return {
    statusCode: 200,
    body: JSON.stringify(atualizado)
  };
};
