/* ------------------ SDK Generator ------------------ */
export async function createSDK(openapiUrl, options = {}) {
  const spec = await fetch(openapiUrl).then((r) => r.json());
  const baseUrl = options.baseUrl ?? openapiUrl.replace(/\/openapi\.json$/, "");
  const cache = options.cache ?? new Map();
  const storageKey = options.storageKey ?? null;

  const state = {
    token: options.token ?? null,
  };

  if (storageKey) {
    const storedToken = loadStoredToken(storageKey);
    if (storedToken !== null && storedToken !== undefined) {
      state.token = storedToken;
    }
  }

  const getToken = () => state.token ?? null;
  const setToken = (next) => {
    state.token = next ?? null;
    persistStoredToken(storageKey, state.token);
  };

  return createProxy({
    spec,
    baseUrl,
    cache,
    getToken,
    setToken,
    path: [],
  });
}

/* ------------------ Proxy Core ------------------ */

function createProxy({ spec, baseUrl, cache, getToken, setToken, path }) {
  return new Proxy(() => {}, {
    get(_, key) {
      if (key === "then") return undefined;
      if (typeof key === "symbol") return undefined;

      if (key === "token") {
        return getToken();
      }

      if (key === "clear") {
        return () => cache.clear();
      }

      if (key === "setToken") {
        return (value) => setToken(value);
      }

      if (key === "getToken") {
        return () => getToken();
      }

      if (["get", "post", "put", "patch", "delete"].includes(key)) {
        return createCaller({
          spec,
          baseUrl,
          cache,
          getToken,
          path,
          method: key,
        });
      }

      return createProxy({
        spec,
        baseUrl,
        cache,
        getToken,
        setToken,
        path: [...path, key.toString()],
      });
    },
    set(_, key, value) {
      if (key === "token") {
        setToken(value);
        return true;
      }

      return false;
    },
  });
}

/* ------------------ Request Executor ------------------ */

function createCaller({ spec, baseUrl, cache, getToken, path, method }) {
  return async function (payload) {
    const openapiPath = findPath(spec.paths, path);

    if (!openapiPath) {
      throw new Error(`No endpoint matches /${path.join("/")}`);
    }

    const operation = spec.paths[openapiPath]?.[method];
    if (!operation) {
      throw new Error(
        `Method ${method.toUpperCase()} not supported on ${openapiPath}`,
      );
    }

    let url = buildUrl(baseUrl, openapiPath, path);

    // GET payload → query parameters
    if (method === "get" && payload !== undefined) {
      url += buildQueryString(payload);
    }

    const hasBody = ["post", "put", "patch"].includes(method);

    const headers = {
      ...(getToken() && { Authorization: `Bearer ${getToken()}` }),
    };

    let body;

    if (hasBody && payload !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(payload);
    }

    const res = await fetch(url, {
      method: method.toUpperCase(),
      headers,
      body,
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok) {
      return {
        status: res.status,
        error: data,
        path: openapiPath,
        method,
      };
    }

    if (method === "get") {
      const cacheKey = buildCacheKey(openapiPath, path, payload);
      const cached = cache.get(cacheKey);

      if (cached) {
        cached.refresh(data);
        return cached.value;
      }

      const resource = createResource(data);
      cache.set(cacheKey, resource);
      return resource.value;
    }

    return data;
  };
}

/* ------------------ Helpers ------------------ */

function findPath(paths, actualSegments) {
  for (const template of Object.keys(paths)) {
    const t = template.split("/").filter(Boolean);
    if (t.length !== actualSegments.length) continue;

    let match = true;
    for (let i = 0; i < t.length; i++) {
      if (t[i].startsWith("{")) continue;
      if (t[i] !== actualSegments[i]) {
        match = false;
        break;
      }
    }

    if (match) return template;
  }
  return null;
}

function buildUrl(baseUrl, template, actualSegments) {
  let url = baseUrl + template;
  const t = template.split("/").filter(Boolean);

  for (let i = 0; i < t.length; i++) {
    if (t[i].startsWith("{")) {
      const param = t[i].slice(1, -1);
      url = url.replace(`{${param}}`, actualSegments[i]);
    }
  }

  return url;
}

function buildQueryString(params) {
  if (!params || typeof params !== "object") return "";

  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      for (const v of value) {
        search.append(key, String(v));
      }
    } else {
      search.append(key, String(value));
    }
  }

  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

function buildCacheKey(openapiPath, pathSegments, payload) {
  let payloadKey = "";

  if (payload && typeof payload === "object") {
    payloadKey = JSON.stringify(
      Object.keys(payload)
        .sort()
        .reduce((acc, key) => {
          acc[key] = payload[key];
          return acc;
        }, {}),
    );
  } else {
    payloadKey = payload ?? "";
  }

  return `${openapiPath}|${pathSegments.join("/")}|${payloadKey}`;
}

function createResource(initialData) {
  const value = createContainer(initialData);

  const refresh = (next) => {
    syncValue(value, next);
    return value;
  };

  refresh(initialData);

  return { value, refresh };
}

function createContainer(sample) {
  if (Array.isArray(sample)) {
    return [];
  }

  if (isPlainObject(sample)) {
    return {};
  }

  return { value: sample };
}

function syncValue(target, next) {
  if (Array.isArray(target) && Array.isArray(next)) {
    target.length = 0;
    target.push(...next);
    return target;
  }

  if (isPlainObject(target) && isPlainObject(next)) {
    for (const key of Object.keys(target)) {
      if (!(key in next)) {
        delete target[key];
      }
    }

    Object.assign(target, next);
    return target;
  }

  target.value = next;
  return target;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadStoredToken(storageKey) {
  if (!storageKey || typeof localStorage === "undefined") return null;

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.token ?? null;
  } catch (error) {
    console.warn("Unable to parse stored token", error);
    return null;
  }
}

function persistStoredToken(storageKey, token) {
  if (!storageKey || typeof localStorage === "undefined") return;
  const payload = JSON.stringify({ token: token ?? null });
  localStorage.setItem(storageKey, payload);
}
