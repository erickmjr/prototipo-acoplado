import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand
} from "@aws-sdk/lib-dynamodb";

const cliente = new DynamoDBClient({});
const documento = DynamoDBDocumentClient.from(cliente);
const TABELA = process.env.TABELA_RESTAURANTES ?? "restaurantes";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const id = event.pathParameters?.id;

  if (!id) {
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

  if ("cnpj" in corpo) {
    return {
      statusCode: 422,
      body: JSON.stringify({
        codigo: "CNPJ_NAO_EDITAVEL",
        mensagem: "O CNPJ não pode ser alterado após o cadastro."
      })
    };
  }

  const resultado = await documento.send(
    new GetCommand({ TableName: TABELA, Key: { id } })
  );

  if (!resultado.Item) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        codigo: "RESTAURANTE_NAO_ENCONTRADO",
        mensagem: "Restaurante não encontrado."
      })
    };
  }

  const atual = resultado.Item as Record<string, unknown>;

  if (atual.status !== "ATIVO") {
    return {
      statusCode: 409,
      body: JSON.stringify({
        codigo: "RESTAURANTE_INATIVO",
        mensagem: "Não é possível editar um restaurante inativo."
      })
    };
  }

  const alteracoes: Record<string, unknown> = {};

  if ("nome" in corpo) {
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
    alteracoes.nome = nome;
  }

  if ("email" in corpo) {
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
    alteracoes.email = email;
  }

  if ("telefone" in corpo) {
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
    alteracoes.telefone = telefone;
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

  const atualizado = {
    ...atual,
    ...alteracoes,
    atualizadoEm: new Date().toISOString()
  };

  await documento.send(new PutCommand({ TableName: TABELA, Item: atualizado }));

  return {
    statusCode: 200,
    body: JSON.stringify(atualizado)
  };
};
