interface Fetcher { fetch(request: Request): Promise<Response> }
interface D1Database {
  prepare(sql: string): { bind(...values: unknown[]): any; first(): Promise<any>; all(): Promise<any>; run(): Promise<any> };
  batch(statements: any[]): Promise<any[]>;
}
declare module 'cloudflare:workers' {
  export const env: { DB?: any; ADMIN_EMAIL?: string };
}
