const client = String(process.env.DB_CLIENT || "mysql").toLowerCase() === "postgres"
  ? "postgres"
  : "mysql";

function param(index) {
  return client === "postgres" ? `$${index}` : "?";
}

function placeholders(count, startIndex = 1) {
  return Array.from({ length: count }, (_, offset) => param(startIndex + offset)).join(", ");
}

module.exports = {
  client,
  param,
  placeholders,
};
