# bakery-sdk

Proxy-based SDK generator for OpenAPI specifications.
Also known as `bakery-sdk |  jevido-sdk`.
I picked jevido-sdk for npmjs, because some dude claimed that @bakery/sdk was too close to some other pancakeswap related sdk...

## Install

```bash
bun add jevido-sdk
```

## Usage

```js
import { createSDK } from "bakery-sdk";

const sdk = await createSDK("https://api.example.com/openapi.json");

const result = await sdk.auth.login.post({
  email: "hello@example.com",
  password: "secret",
});

const updated = await sdk.users[42069].patch({
  email: "something@awesome.com",
});
```

### Options

```js
const sdk = await createSDK("https://api.example.com/openapi.json", {
  baseUrl: "https://api.example.com",
  token: "token-123",
  storageKey: "bakery-token",
});
```

- `baseUrl` overrides the default derived base URL.
- `token` sets the bearer token for requests.
- `storageKey` persists the token in `localStorage`.

## Testing

```bash
bun test
```

## Notes

- Supported methods: `get`, `post`, `put`, `patch`, `delete`.
- `sdk.token = "..."` updates the bearer token.
- `sdk.clear()` clears the GET cache.
