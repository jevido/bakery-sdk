# bakery-sdk

Proxy-based SDK generator for OpenAPI specifications.
Also known as `bakery-sdk | jevido-sdk`.

I picked **jevido-sdk** for npmjs, because some dude claimed that `@bakery/sdk` was too close to some other pancakeswap-related SDK.

---

## Install

```bash
bun add jevido-sdk
```

---

## Usage

```js
import { createSDK } from "jevido-sdk";

const sdk = await createSDK("https://api.example.com/openapi.json");

const result = await sdk.auth.login.post({
  email: "hello@example.com",
  password: "secret",
});

const updated = await sdk.users[42069].patch({
  email: "something@awesome.com",
});
```

---

## GET requests & query parameters

For **GET requests**, the payload is automatically translated into **URL search parameters**.

```js
await sdk.users.get({
  page: 2,
  limit: 25,
  search: "john",
});
```

Results in:

```http
GET /users?page=2&limit=25&search=john
```

Notes:

- GET requests **never send a body**
- `undefined` and `null` values are skipped
- Arrays are serialized as repeated parameters:

  ```js
  {
    role: ["admin", "moderator"];
  }
  // → ?role=admin&role=moderator
  ```

---

## Path parameters

Path parameters are inferred from property access:

```js
await sdk.users[123].get(); // GET /users/123
await sdk.users[123].patch(); // PATCH /users/123
```

The matching path **must exist in the OpenAPI spec**.

---

## Options

```js
const sdk = await createSDK("https://api.example.com/openapi.json", {
  baseUrl: "https://api.example.com",
  token: "token-123",
  storageKey: "bakery-token",
});
```

- `baseUrl`
  Overrides the base URL derived from the OpenAPI URL.
- `token`
  Sets the bearer token used for requests.
- `storageKey`
  Persists the token in `localStorage`.

You can also update the token later:

```js
sdk.token = "new-token";
```

---

## OpenAPI requirements

This SDK is **strictly OpenAPI-driven**.

For a call like:

```js
sdk.users.get();
```

Your OpenAPI spec **must contain**:

```json
"/users": {
  "get": {}
}
```

Minimal specs are fully supported.
Schemas, parameters, and responses are **optional** for SDK usage.

---

## Caching

- GET requests are cached by:
  - OpenAPI path
  - resolved path parameters
  - query parameters

- Cached resources are **reactively updated** on re-fetch

Clear the cache with:

```js
sdk.clear();
```

---

## Testing

```bash
bun test
```

Tests typically use a **mock OpenAPI spec** with only paths and methods defined.

---

## Notes

- Supported methods: `get`, `post`, `put`, `patch`, `delete`
- GET payloads become query parameters
- Non-GET payloads are sent as JSON bodies
- SDK will throw if a path or method does not exist in OpenAPI

---

Minimal by design, strict by default, and zero codegen.
