import { defineConfig } from "orval";

export default defineConfig({
  picnivo: {
    input: "../backend/Picnivo.API/Picnivo.API.json",
    output: {
      target: "src/api/picnivo-api.ts",
      client: "react-query",
      override: {
        mutator: {
          path: "src/api/axios-instance.ts",
          name: "axiosInstance",
        },
        requestOptions: true,
      },
    },
  },
});
