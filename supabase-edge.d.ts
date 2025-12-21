declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

declare module 'https://esm.sh/@supabase/supabase-js@2.87.1' {
  export const createClient: any;
}
