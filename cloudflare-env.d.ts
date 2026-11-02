declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    STANDALONE?: string;
    APP_PASSWORD?: string;
    BRAVE_SEARCH_API_KEY?: string;
    SCHEDULER_ENABLED?: string;
    ASSETS?: Fetcher;
    APP_ORIGIN?: string;
    JSEARCH_API_KEY?: string;
  }
}
