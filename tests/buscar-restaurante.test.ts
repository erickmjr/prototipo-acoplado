import { beforeEach, describe, expect, it } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { handler } from "../src/handlers/buscar-restaurante.js";

// Simulação do SDK do provedor de nuvem, necessária mesmo neste caso de uso,
// que não possui regra de negócio própria.
const dynamo = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  dynamo.reset();
});

function evento(id?: string): APIGatewayProxyEvent {
  return { pathParameters: id ? { id } : null } as unknown as APIGatewayProxyEvent;
}

describe("buscar restaurante", () => {
  it("devolve o restaurante quando ele existe", async () => {
    dynamo.on(GetCommand).resolves({
      Item: { id: "r-1", nome: "Cantina do Porto", status: "ATIVO" }
    });

    const resposta = await handler(evento("r-1"));

    expect(resposta.statusCode).toBe(200);
    expect(JSON.parse(resposta.body).nome).toBe("Cantina do Porto");
  });

  it("devolve 404 quando o restaurante não existe", async () => {
    dynamo.on(GetCommand).resolves({});

    const resposta = await handler(evento("inexistente"));

    expect(resposta.statusCode).toBe(404);
    expect(JSON.parse(resposta.body).codigo).toBe("RESTAURANTE_NAO_ENCONTRADO");
  });

  it("recusa requisição sem identificador", async () => {
    const resposta = await handler(evento());

    expect(resposta.statusCode).toBe(400);
    expect(JSON.parse(resposta.body).codigo).toBe("REQUISICAO_INVALIDA");
  });
});
