export interface DatabaseEnvironment {
  readonly DATABASE_URL?: string;
  readonly DB_HOST?: string;
  readonly DB_PORT?: string;
  readonly DB_USER?: string;
  readonly DB_PASS?: string;
  readonly DB_NAME?: string;
}

export function resolveDatabaseUrl(environment: DatabaseEnvironment = process.env): string {
  const hasDiscreteConfiguration = [
    environment.DB_HOST,
    environment.DB_USER,
    environment.DB_PASS,
    environment.DB_NAME,
  ].some((value) => value !== undefined);

  if (hasDiscreteConfiguration) {
    const required = {
      DB_HOST: environment.DB_HOST,
      DB_USER: environment.DB_USER,
      DB_PASS: environment.DB_PASS,
      DB_NAME: environment.DB_NAME,
    };
    const missing = Object.entries(required)
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(`Missing database variables: ${missing.join(", ")}`);
    }

    const port = environment.DB_PORT ?? "3306";
    if (!/^\d{1,5}$/.test(port) || Number(port) > 65_535) {
      throw new Error("DB_PORT must be a valid TCP port");
    }

    const host = required.DB_HOST as string;
    const user = encodeURIComponent(required.DB_USER as string);
    const password = encodeURIComponent(required.DB_PASS as string);
    const database = encodeURIComponent(required.DB_NAME as string);

    return `mysql://${user}:${password}@${host}:${port}/${database}`;
  }

  if (!environment.DATABASE_URL) {
    throw new Error("Set DB_HOST, DB_USER, DB_PASS and DB_NAME, or provide DATABASE_URL");
  }

  return environment.DATABASE_URL;
}
