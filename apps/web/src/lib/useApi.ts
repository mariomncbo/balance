import { useEffect, useState } from "react";
import { useData } from "../state/DataContext";
import { api, ApiError } from "./api";

export interface ApiState<T> {
  data: T | undefined;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
}

/** Pide `action` a la API y se repite cuando cambian los parámetros o algún dato de la app. */
export function useApi<T>(action: string, params: Record<string, unknown> = {}): ApiState<T> {
  const { version, invalidate } = useData();
  const [state, setState] = useState<{ data: T | undefined; error: ApiError | null; loading: boolean }>({
    data: undefined,
    error: null,
    loading: true,
  });
  const key = JSON.stringify([action, params, version]);

  useEffect(() => {
    let alive = true;
    api<T>(action, (JSON.parse(key) as [string, Record<string, unknown>, number])[1]).then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (e: unknown) =>
        alive &&
        setState((s) => ({
          data: s.data,
          loading: false,
          error: e instanceof ApiError ? e : new ApiError("Algo ha fallado.", 500),
        })),
    );
    return () => {
      alive = false;
    };
    // `key` resume action, params y version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { ...state, reload: invalidate };
}
