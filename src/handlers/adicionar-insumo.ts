import { randomUUID } from "node:crypto";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand
} from "@aws-sdk/lib-dynamodb";

const cliente = new DynamoDBClient({});
const documento = DynamoDBDocumentClient.from(cliente);
const TABELA_RESTAURANTES = process.env.TABELA_RESTAURANTES ?? "restaurantes";
const TABELA_INSUMOS = process.env.TABELA_INSUMOS ?? "insumos";

const UNIDADES = ["KG", "L", "UN"];

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const restauranteId = event.pathParameters?.id;

  if (!restauranteId) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        codigo: "REQUISICAO_INVALIDA",
        mensagem: "O identificador do restaurante não foi informado."
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

  const unidade = typeof corpo.unidade === "string" ? corpo.unidade.toUpperCase() : "";
  if (!UNIDADES.includes(unidade)) {
    return {
      statusCode: 422,
      body: JSON.stringify({
        codigo: "UNIDADE_INVALIDA",
        mensagem: "A unidade deve ser KG, L ou UN."
      })
    };
  }

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

  if (unidade === "UN" && !Number.isInteger(quantidade)) {
    return {
      statusCode: 422,
      body: JSON.stringify({
        codigo: "QUANTIDADE_INVALIDA",
        mensagem: "Insumos medidos em unidade não aceitam quantidade fracionada."
      })
    };
  }

  const precoUnitarioCentavos = Number(corpo.precoUnitarioCentavos);
  if (!Number.isInteger(precoUnitarioCentavos) || precoUnitarioCentavos <= 0) {
    return {
      statusCode: 422,
      body: JSON.stringify({
        codigo: "PRECO_INVALIDO",
        mensagem: "O preço unitário deve ser um inteiro de centavos maior que zero."
      })
    };
  }

  const estoqueMinimo = Number(corpo.estoqueMinimo ?? 0);
  if (!Number.isFinite(estoqueMinimo) || estoqueMinimo < 0) {
    return {
      statusCode: 422,
      body: JSON.stringify({
        codigo: "ESTOQUE_MINIMO_INVALIDO",
        mensagem: "O estoque mínimo deve ser um número maior ou igual a zero."
      })
    };
  }

  const restaurante = await documento.send(
    new GetCommand({ TableName: TABELA_RESTAURANTES, Key: { id: restauranteId } })
  );

  if (!restaurante.Item) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        codigo: "RESTAURANTE_NAO_ENCONTRADO",
        mensagem: "Restaurante não encontrado."
      })
    };
  }

  if (restaurante.Item.status !== "ATIVO") {
    return {
      statusCode: 409,
      body: JSON.stringify({
        codigo: "RESTAURANTE_INATIVO",
        mensagem: "Não é possível adicionar insumos a um restaurante inativo."
      })
    };
  }

  const insumo = {
    id: randomUUID(),
    restauranteId,
    nome,
    unidade,
    quantidade,
    precoUnitarioCentavos,
    estoqueMinimo,
    abaixoDoMinimo: quantidade < estoqueMinimo,
    valorTotalCentavos: Math.round(quantidade * precoUnitarioCentavos),
    criadoEm: new Date().toISOString()
  };

  await documento.send(
    new PutCommand({
      TableName: TABELA_INSUMOS,
      Item: insumo,
      ConditionExpression: "attribute_not_exists(id)"
    })
  );

  return {
    statusCode: 201,
    body: JSON.stringify(insumo)
  };
};
