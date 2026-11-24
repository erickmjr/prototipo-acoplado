import { randomUUID } from "node:crypto";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand
} from "@aws-sdk/lib-dynamodb";

const cliente = new DynamoDBClient({});
const documento = DynamoDBDocumentClient.from(cliente);
const TABELA = process.env.TABELA_RESTAURANTES ?? "restaurantes";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
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
  if (nome.length < 3 || nome.length > 120) {
    return {
      statusCode: 422,
      body: JSON.stringify({
        codigo: "NOME_INVALIDO",
        mensagem: "O nome do restaurante deve ter entre 3 e 120 caracteres."
      })
    };
  }

  const cnpjBruto = typeof corpo.cnpj === "string" ? corpo.cnpj : "";
  const cnpj = cnpjBruto.replace(/\D/g, "");
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) {
    return {
      statusCode: 422,
      body: JSON.stringify({
        codigo: "CNPJ_INVALIDO",
        mensagem: "O CNPJ deve conter 14 dígitos e não pode ser uma sequência repetida."
      })
    };
  }

  const email = typeof corpo.email === "string" ? corpo.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      statusCode: 422,
      body: JSON.stringify({
        codigo: "EMAIL_INVALIDO",
        mensagem: "O e-mail informado não é válido."
      })
    };
  }

  const telefoneBruto = typeof corpo.telefone === "string" ? corpo.telefone : "";
  const telefone = telefoneBruto.replace(/\D/g, "");
  if (telefone.length < 10 || telefone.length > 11) {
    return {
      statusCode: 422,
      body: JSON.stringify({
        codigo: "TELEFONE_INVALIDO",
        mensagem: "O telefone deve conter 10 ou 11 dígitos."
      })
    };
  }

  const duplicados = await documento.send(
    new QueryCommand({
      TableName: TABELA,
      IndexName: "cnpj-index",
      KeyConditionExpression: "cnpj = :cnpj",
      ExpressionAttributeValues: { ":cnpj": cnpj },
      Limit: 1
    })
  );

  if ((duplicados.Items ?? []).length > 0) {
    return {
      statusCode: 409,
      body: JSON.stringify({
        codigo: "CNPJ_JA_CADASTRADO",
        mensagem: "Já existe um restaurante cadastrado com este CNPJ."
      })
    };
  }

  const restaurante = {
    id: randomUUID(),
    nome,
    cnpj,
    email,
    telefone,
    status: "ATIVO",
    criadoEm: new Date().toISOString()
  };

  await documento.send(
    new PutCommand({
      TableName: TABELA,
      Item: restaurante,
      ConditionExpression: "attribute_not_exists(id)"
    })
  );

  return {
    statusCode: 201,
    body: JSON.stringify(restaurante)
  };
};
