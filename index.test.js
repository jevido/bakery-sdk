import { afterEach, beforeEach, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { createSDK } from "./index.js";

const openapiUrl = "https://api.local/openapi.json";
const baseUrl = "https://api.local";
const spec = JSON.parse(
  await readFile(new URL("./openapi.json", import.meta.url), "utf8")
);

let originalFetch;
let fetchCalls;

beforeEach(() => {
  fetchCalls = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const urlString = String(url);
    fetchCalls.push({ url: urlString, options });

    if (urlString === openapiUrl) {
      return new Response(JSON.stringify(spec), { status: 200 });
    }

    if (urlString === `${baseUrl}/auth/login`) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("posts login payload using the openapi base url", async () => {
  const sdk = await createSDK(openapiUrl);
  const payload = { email: "hello@example.com", password: "secret" };

  const result = await sdk.auth.login.post(payload);

  expect(result).toEqual({ ok: true });
  expect(fetchCalls[0].url).toBe(openapiUrl);
  expect(fetchCalls[1].url).toBe(`${baseUrl}/auth/login`);
  expect(fetchCalls[1].options.method).toBe("POST");
  expect(fetchCalls[1].options.headers["Content-Type"]).toBe(
    "application/json"
  );
  expect(fetchCalls[1].options.body).toBe(JSON.stringify(payload));
});

test("adds bearer token when set on the sdk", async () => {
  const sdk = await createSDK(openapiUrl);
  sdk.token = "token-123";

  await sdk.auth.login.post({ email: "me@example.com", password: "secret" });

  const loginCall = fetchCalls.find(
    (call) => call.url === `${baseUrl}/auth/login`
  );
  expect(loginCall).toBeDefined();
  expect(loginCall.options.headers.Authorization).toBe("Bearer token-123");
});

test("patches a user by id with a payload", async () => {
  const sdk = await createSDK(openapiUrl);
  const payload = { email: "something@awesome.com" };

  const result = await sdk.users[42069].patch(payload);

  expect(result).toEqual({ ok: true });
  expect(fetchCalls[0].url).toBe(openapiUrl);
  expect(fetchCalls[1].url).toBe(`${baseUrl}/users/42069`);
  expect(fetchCalls[1].options.method).toBe("PATCH");
  expect(fetchCalls[1].options.headers["Content-Type"]).toBe(
    "application/json"
  );
  expect(fetchCalls[1].options.body).toBe(JSON.stringify(payload));
});

test("translates get payload into url search parameters", async () => {
  const sdk = await createSDK(openapiUrl);

  await sdk.users.get({
    page: 2,
    limit: 25,
    search: "john",
  });

  expect(fetchCalls[0].url).toBe(openapiUrl);

  const getCall = fetchCalls[1];
  expect(getCall).toBeDefined();

  expect(getCall.url).toBe(`${baseUrl}/users?page=2&limit=25&search=john`);

  expect(getCall.options.method).toBe("GET");
  expect(getCall.options.body).toBeUndefined();
});

test("skips undefined and null query params", async () => {
  const sdk = await createSDK(openapiUrl);

  await sdk.users.get({
    page: 1,
    filter: undefined,
    q: null,
  });

  expect(fetchCalls[1].url).toBe(`${baseUrl}/users?page=1`);
});

test("supports array query parameters", async () => {
  const sdk = await createSDK(openapiUrl);

  await sdk.users.get({ role: ["admin", "moderator"] });

  expect(fetchCalls[1].url).toBe(
    `${baseUrl}/users?role=admin&role=moderator`,
  );
});
