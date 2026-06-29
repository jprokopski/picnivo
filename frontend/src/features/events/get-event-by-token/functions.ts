import { createServerFn } from "@tanstack/react-start";
import { isAxiosError } from "axios";
import { getEventByToken } from "../../../api/picnivo-api";
import { tokenSchema } from "./schema";

export const getEventByTokenFn = createServerFn({ method: "GET" })
  .inputValidator(tokenSchema)
  .handler(async ({ data }) => {
    try {
      return await getEventByToken(data.token);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 404) return null;
      throw err;
    }
  });
