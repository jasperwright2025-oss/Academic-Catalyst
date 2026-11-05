// Web search answers carry <cite index="..."> markers. They mean nothing to a reader, so remove them.
export function stripCites(value) {
  if (typeof value === "string") return value.replace(/<\/?cite\b[^>]*>/gi, "");
  if (Array.isArray(value)) return value.map(stripCites);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripCites(v)]));
  }
  return value;
}
