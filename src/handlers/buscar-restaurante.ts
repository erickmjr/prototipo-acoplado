import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

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

  return {
    statusCode: 200,
    body: JSON.stringify(resultado.Item)
  };
};
