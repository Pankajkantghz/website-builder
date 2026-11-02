import "dotenv/config";
import app from "./app.js";

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
