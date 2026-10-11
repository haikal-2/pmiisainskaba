import 'server-only';

import { parseServerConfig, type ServerConfig } from './config-values';

const config: ServerConfig = parseServerConfig(process.env);

export type { ServerConfig };
export { parseServerConfig };
export default config;
