import { beforeEach, describe, expect, it } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand
} from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { handler } from "../src/handlers/criar-restaurante.js";

// Simulação do SDK do provedor de nuvem. Como a regra de negócio vive dentro
// do handler, não há como exercitá-la sem antes interceptar o cliente do
// DynamoDB: toda verificação de validação depende desta montagem.
const dynamo = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  dynamo.reset();
  dynamo.on(QueryCommand).resolves({ Items: [] });
  dynamo.on(PutCommand).resolves({});
});

function evento(corpo: unknown): APIGatewayProxyEvent {
  return { body: JSON.stringify(corpo) } as APIGatewayProxyEvent;
}

const valido = {
  nome: "Cantina do Porto",
  cnpj: "12.345.678/0001-95",
  email: "contato@cantinadoporto.com.br",
  telefone: "(75) 98888-1234"
};

describe("criar restaurante", () => {
  it("cria o restaurante quando os dados são válidos", async () => {
    const resposta = await handler(evento(valido));
    const corpo = JSON.parse(resposta.body);

    expect(resposta.statusCode).toBe(201);
    expect(corpo.nome).toBe("Cantina do Porto");
    expect(corpo.cnpj).toBe("12345678000195");
    expect(corpo.telefone).toBe("75988881234");
    expect(corpo.status).toBe("ATIVO");
    expect(corpo.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("normaliza o e-mail para caixa baixa", async () => {
    const resposta = await handler(
      evento({ ...valido, email: "Contato@Cantina.COM.BR" })
    );

    expect(JSON.parse(resposta.body).email).toBe("contato@cantina.com.br");
  });

  it("recusa corpo que não é JSON válido", async () => {
    const resposta = await handler({ body: "{{" } as APIGatewayProxyEvent);

    expect(resposta.statusCode).toBe(400);
    expect(JSON.parse(resposta.body).codigo).toBe("REQUISICAO_INVALIDA");
  });

  it("recusa nome com menos de três caracteres", async () => {
    const resposta = await handler(evento({ ...valido, nome: "Oi" }));

    expect(resposta.statusCode).toBe(422);
    expect(JSON.parse(resposta.body).codigo).toBe("NOME_INVALIDO");
  });

  it("recusa CNPJ com quantidade de dígitos incorreta", async () => {
    const resposta = await handler(evento({ ...valido, cnpj: "123" }));

    expect(resposta.statusCode).toBe(422);
    expect(JSON.parse(resposta.body).codigo).toBe("CNPJ_INVALIDO");
  });

  it("recusa CNPJ formado por dígitos repetidos", async () => {
    const resposta = await handler(
      evento({ ...valido, cnpj: "11111111111111" })
    );

    expect(resposta.statusCode).toBe(422);
    expect(JSON.parse(resposta.body).codigo).toBe("CNPJ_INVALIDO");
  });

  it("recusa e-mail em formato inválido", async () => {
    const resposta = await handler(evento({ ...valido, email: "contato@" }));

    expect(resposta.statusCode).toBe(422);
    expect(JSON.parse(resposta.body).codigo).toBe("EMAIL_INVALIDO");
  });

  it("recusa telefone com menos de dez dígitos", async () => {
    const resposta = await handler(evento({ ...valido, telefone: "9999" }));

    expect(resposta.statusCode).toBe(422);
    expect(JSON.parse(resposta.body).codigo).toBe("TELEFONE_INVALIDO");
  });

  it("recusa CNPJ já cadastrado", async () => {
    dynamo.on(QueryCommand).resolves({ Items: [{ id: "existente" }] });

    const resposta = await handler(evento(valido));

    expect(resposta.statusCode).toBe(409);
    expect(JSON.parse(resposta.body).codigo).toBe("CNPJ_JA_CADASTRADO");
  });
});
