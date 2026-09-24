/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL, e.g. https://abc.lambda-url.us-east-1.on.aws (empty: same origin). */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
