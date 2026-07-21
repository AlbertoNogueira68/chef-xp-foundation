/**
 * Único ponto de entrada para o cliente do provider (Lovable Cloud/Supabase).
 *
 * Nenhum ficheiro fora de `src/data/providers/lovable/` deve importar o
 * cliente diretamente. Isto garante que substituir o provider (por uma API
 * REST própria em Fastify, por exemplo) exija alterar apenas esta pasta.
 */
export { supabase } from "@/integrations/supabase/client";
export { lovable } from "@/integrations/lovable/index";
