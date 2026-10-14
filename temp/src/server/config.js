"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseServerConfig = void 0;
require("server-only");
const config_values_1 = require("./config-values");
Object.defineProperty(exports, "parseServerConfig", { enumerable: true, get: function () { return config_values_1.parseServerConfig; } });
const config = (0, config_values_1.parseServerConfig)(process.env);
exports.default = config;
