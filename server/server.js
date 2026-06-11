const db = require("./db");
const { createApp } = require("./createApp");

const port = Number(process.env.PORT || 3000);
const app = createApp();

app.listen(port, async () => {
  console.log(`Server listening on port ${port}`);
  try {
    await db.ping();
    console.log("Database connection OK");
  } catch (error) {
    console.error("Database connection failed", error);
  }
});
