import { beforeEach, describe, expect, it } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand
} from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { handler } from "../src/handlers/adicionar-insumo.js";

// Simulação do SDK do provedor de nuvem. Note que mesmo as validações puras
// de quantidade e preço só podem ser exercitadas através do handler, que
// depende do cliente do DynamoDB para completar a execução.
const dynamo = mockClient(DynamoDBDocumentClient);

const restauranteAtivo = { id: "r-1", nome: "Cantina do Porto", status: "ATIVO" };

beforeEach(() => {
  dynamo.reset();
  dynamo.on(GetCommand).resolves({ Item: restauranteAtivo });
  dynamo.on(PutCommand).resolves({});
});

function evento(corpo: unknown, id: string | null = "r-1"): APIGatewayProxyEvent {
  return {
    pathParameters: id ? { id } : null,
    body: JSON.stringify(corpo)
  } as unknown as APIGatewayProxyEvent;
}

const valido = {
  nome: "Farinha de trigo",
  unidade: "KG",
  quantidade: 25,
  precoUnitarioCentavos: 480,
  estoqueMinimo: 10
};

describe("adicionar insumo", () => {
  it("cria o insumo quando os dados são válidos", async () => {
    const resposta = await handler(evento(valido));
    const corpo = JSON.parse(resposta.body);

    expect(resposta.statusCode).toBe(201);
    expect(corpo.nome).toBe("Farinha de trigo");
    expect(corpo.restauranteId).toBe("r-1");
    expect(corpo.valorTotalCentavos).toBe(12000);
    expect(corpo.abaixoDoMinimo).toBe(false);
  });

  it("marca o insumo como abaixo do mínimo quando a quantidade é menor", async () => {
    const resposta = await handler(
      evento({ ...valido, quantidade: 5, estoqueMinimo: 10 })
    );

    expect(JSON.parse(resposta.body).abaixoDoMinimo).toBe(true);
  });

  it("recusa unidade fora do conjunto permitido", async () => {
    const resposta = await handler(evento({ ...valido, unidade: "CAIXA" }));

    expect(resposta.statusCode).toBe(422);
    expect(JSON.parse(resposta.body).codigo).toBe("UNIDADE_INVALIDA");
  });

  it("recusa quantidade negativa", async () => {
    const resposta = await handler(evento({ ...valido, quantidade: -1 }));

    expect(resposta.statusCode).toBe(422);
    expect(JSON.parse(resposta.body).codigo).toBe("QUANTIDADE_INVALIDA");
  });

  it("recusa quantidade fracionada para unidade UN", async () => {
    const resposta = await handler(
      evento({ ...valido, unidade: "UN", quantidade: 2.5 })
    );

    expect(resposta.statusCode).toBe(422);
    expect(JSON.parse(resposta.body).codigo).toBe("QUANTIDADE_INVALIDA");
  });

  it("recusa preço unitário igual a zero", async () => {
    const resposta = await handler(
      evento({ ...valido, precoUnitarioCentavos: 0 })
    );

    expect(resposta.statusCode).toBe(422);
    expect(JSON.parse(resposta.body).codigo).toBe("PRECO_INVALIDO");
  });

  it("recusa estoque mínimo negativo", async () => {
    const resposta = await handler(evento({ ...valido, estoqueMinimo: -5 }));

    expect(resposta.statusCode).toBe(422);
    expect(JSON.parse(resposta.body).codigo).toBe("ESTOQUE_MINIMO_INVALIDO");
  });

  it("recusa insumo para restaurante inexistente", async () => {
    dynamo.on(GetCommand).resolves({});

    const resposta = await handler(evento(valido));

    expect(resposta.statusCode).toBe(404);
    expect(JSON.parse(resposta.body).codigo).toBe("RESTAURANTE_NAO_ENCONTRADO");
  });

  it("recusa insumo para restaurante inativo", async () => {
    dynamo.on(GetCommand).resolves({
      Item: { ...restauranteAtivo, status: "INATIVO" }
    });

    const resposta = await handler(evento(valido));

    expect(resposta.statusCode).toBe(409);
    expect(JSON.parse(resposta.body).codigo).toBe("RESTAURANTE_INATIVO");
  });
});
