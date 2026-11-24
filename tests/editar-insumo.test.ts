import { beforeEach, describe, expect, it } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand
} from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { handler } from "../src/handlers/editar-insumo.js";

// Simulação do SDK do provedor de nuvem, repetida em cada arquivo de teste
// porque não existe ponto de composição independente da infraestrutura.
const dynamo = mockClient(DynamoDBDocumentClient);

const existente = {
  id: "i-1",
  restauranteId: "r-1",
  nome: "Farinha de trigo",
  unidade: "KG",
  quantidade: 25,
  precoUnitarioCentavos: 480,
  estoqueMinimo: 10,
  abaixoDoMinimo: false,
  valorTotalCentavos: 12000
};

beforeEach(() => {
  dynamo.reset();
  dynamo.on(GetCommand).resolves({ Item: existente });
  dynamo.on(PutCommand).resolves({});
});

function evento(
  corpo: unknown,
  insumoId: string | null = "i-1"
): APIGatewayProxyEvent {
  return {
    pathParameters: insumoId ? { insumoId } : null,
    body: JSON.stringify(corpo)
  } as unknown as APIGatewayProxyEvent;
}

describe("editar insumo", () => {
  it("recalcula o valor total ao alterar a quantidade", async () => {
    const resposta = await handler(evento({ quantidade: 30 }));
    const corpo = JSON.parse(resposta.body);

    expect(resposta.statusCode).toBe(200);
    expect(corpo.quantidade).toBe(30);
    expect(corpo.valorTotalCentavos).toBe(14400);
  });

  it("recalcula a sinalização de estoque mínimo", async () => {
    const resposta = await handler(evento({ quantidade: 3 }));

    expect(JSON.parse(resposta.body).abaixoDoMinimo).toBe(true);
  });

  it("recalcula o valor total ao alterar o preço", async () => {
    const resposta = await handler(evento({ precoUnitarioCentavos: 500 }));

    expect(JSON.parse(resposta.body).valorTotalCentavos).toBe(12500);
  });

  it("devolve 404 quando o insumo não existe", async () => {
    dynamo.on(GetCommand).resolves({});

    const resposta = await handler(evento({ quantidade: 1 }));

    expect(resposta.statusCode).toBe(404);
    expect(JSON.parse(resposta.body).codigo).toBe("INSUMO_NAO_ENCONTRADO");
  });

  it("recusa quantidade fracionada quando a unidade é UN", async () => {
    dynamo.on(GetCommand).resolves({
      Item: { ...existente, unidade: "UN" }
    });

    const resposta = await handler(evento({ quantidade: 1.5 }));

    expect(resposta.statusCode).toBe(422);
    expect(JSON.parse(resposta.body).codigo).toBe("QUANTIDADE_INVALIDA");
  });

  it("recusa preço unitário negativo", async () => {
    const resposta = await handler(evento({ precoUnitarioCentavos: -10 }));

    expect(resposta.statusCode).toBe(422);
    expect(JSON.parse(resposta.body).codigo).toBe("PRECO_INVALIDO");
  });

  it("recusa requisição sem campos editáveis", async () => {
    const resposta = await handler(evento({ campoDesconhecido: 1 }));

    expect(resposta.statusCode).toBe(422);
    expect(JSON.parse(resposta.body).codigo).toBe("NENHUMA_ALTERACAO");
  });
});
