import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    input: './src/contract/openapi.json',
    output: {
      mode: 'tags-split',
      target: './src/api/generated',
      client: 'react-query',
      httpClient: 'axios',
      override: {
        mutator: {
          path: './src/api/http.ts',
          name: 'apiFetch',
        },
      },
    },
  },
});
