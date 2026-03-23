import dotenv from "dotenv";

import { createApp } from "./app";

dotenv.config();

const port = Number(process.env.PORT || 4000);
const app = createApp();

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
