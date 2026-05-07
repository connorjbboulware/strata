export interface HealthResponse {
  status: 'ok';
  ts: string;
  db: 'ok' | 'down';
}
