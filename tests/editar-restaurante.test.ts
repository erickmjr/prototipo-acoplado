import { beforeEach, describe, expect, it } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand
} from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { handler } from "../src/handlers/editar-restaurante.js";

// Simulação do SDK do provedor de nuvem. Cada cenário de validação exige
// preparar previamente a resposta do GetCommand, porque a regra de negócio
// só é alcançada depois da leitura no banco.
const dynamo = mockClient(DynamoDBDocumentClient);

const existente = {
  id: "r-1",
  nome: "Cantina do Porto",
  cnpj: "12345678000195",
  email: "contato@cantinadoporto.com.br",
  telefone: "75988881234",
  status: "ATIVO"
};

beforeEach(() => {
  dynamo.reset();
  dynamo.on(GetCommand).resolves({ Item: existente });
  dynamo.on(PutCommand).resolves({});
});

function evento(corpo: unknown, id: string | null = "r-1"): APIGatewayProxyEvent {
  return {
    pathParameters: id ? { id } : null,
    body: JSON.stringify(corpo)
  } as unknown as APIGatewayProxyEvent;
}

describe("editar restaurante", () => {
  it("atualiza o nome quando os dados são válidos", async () => {
    const resposta = await handler(evento({ nome: "Cantina do Porto Novo" }));
    const corpo = JSON.parse(resposta.body);

    expect(resposta.statusCode).toBe(200);
    expect(corpo.nome).toBe("Cantina do Porto Novo");
    expect(corpo.atualizadoEm).toBeTruthy();
  });

  it("recusa alteração de CNPJ", async () => {
    const resposta = await handler(evento({ cnpj: "99999999000199" }));

    expect(resposta.statusCode).toBe(422);
    expect(JSON.parse(resposta.body).codigo).toBe("CNPJ_NAO_EDITAVEL");
  });

  it("recusa edição de restaurante inativo", async () => {
    dynamo.on(GetCommand).resolves({
      Item: { ...existente, status: "INATIVO" }
    });

    const resposta = await handler(evento({ nome: "Qualquer Nome" }));

    expect(resposta.statusCode).toBe(409);
    expect(JSON.parse(resposta.body).codigo).toBe("RESTAURANTE_INATIVO");
  });

  it("devolve 404 quando o restaurante não existe", async () => {
    dynamo.on(GetCommand).resolves({});

    const resposta = await handler(evento({ nome: "Qualquer Nome" }));

    expect(resposta.statusCode).toBe(404);
    expect(JSON.parse(resposta.body).codigo).toBe("RESTAURANTE_NAO_ENCONTRADO");
  });

  it("recusa nome inválido na edição", async () => {
    const resposta = await handler(evento({ nome: "Ab" }));

    expect(resposta.statusCode).toBe(422);
    expect(JSON.parse(resposta.body).codigo).toBe("NOME_INVALIDO");
  });

  it("recusa e-mail inválido na edição", async () => {
    const resposta = await handler(evento({ email: "invalido" }));

    expect(resposta.statusCode).toBe(422);
    expect(JSON.parse(resposta.body).codigo).toBe("EMAIL_INVALIDO");
  });

  it("recusa telefone inválido na edição", async () => {
    const resposta = await handler(evento({ telefone: "123" }));

    expect(resposta.statusCode).toBe(422);
    expect(JSON.parse(resposta.body).codigo).toBe("TELEFONE_INVALIDO");
  });

  it("recusa requisição sem campos editáveis", async () => {
    const resposta = await handler(evento({ campoDesconhecido: 1 }));

    expect(resposta.statusCode).toBe(422);
    expect(JSON.parse(resposta.body).codigo).toBe("NENHUMA_ALTERACAO");
  });
});
