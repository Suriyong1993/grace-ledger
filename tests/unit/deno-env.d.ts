/**
 * The Edge Function sources under `supabase/functions/` run on Deno, which is
 * not part of this project's runtime. Only their pure guard helpers are unit
 * tested here, so the single global they touch is declared rather than pulling
 * in the whole Deno type package.
 */
declare global {
  // eslint-disable-next-line no-var
  var Deno: {
    env: {
      get(key: string): string | undefined;
    };
  };
}

export {};
