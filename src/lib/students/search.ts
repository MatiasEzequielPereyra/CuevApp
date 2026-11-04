// Keep the search literal through SQL LIKE and PostgREST's quoted-value grammar.
// URL encoding is performed once by supabase-js, not here.
export function studentSearchFilter(value: string) {
  const pattern = `%${value.replace(/[\\%_]/g, "\\$&")}%`;
  const literal = `"${pattern.replace(/[\\"]/g, "\\$&")}"`;
  return ["first_name", "last_name", "email", "dni"]
    .map(column => `${column}.ilike.${literal}`).join(",");
}
