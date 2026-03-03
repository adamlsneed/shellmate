#!/usr/bin/env node
import { createServer } from './index.js';

const PORT = process.env.PORT || 3847;

const app = await createServer();
app.listen(PORT, () => {
  console.log(`Shellmate running at http://localhost:${PORT}`);
});
