import { open, DB_PATH } from './db.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3001);
const server = createApp(open()).listen(port, () =>
  console.log(`menu service on :${port} · db ${DB_PATH} · pid ${process.pid}`));

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
