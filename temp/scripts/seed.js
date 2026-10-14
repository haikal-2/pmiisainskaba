"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("@next/env");
(0, env_1.loadEnvConfig)(process.cwd());
async function main() {
    const [{ getDatabase }, { seedPublicContent }, { default: config }] = await Promise.all([
        Promise.resolve().then(() => __importStar(require('../src/server/db/database'))),
        Promise.resolve().then(() => __importStar(require('../src/server/db/seed'))),
        Promise.resolve().then(() => __importStar(require('../src/server/config'))),
    ]);
    const database = getDatabase();
    try {
        await seedPublicContent(database, undefined, config.mapaba);
        console.log('Public reference content is seeded without overwriting existing edits.');
    }
    finally {
        await database.close?.();
    }
}
main().catch((error) => {
    console.error('Public content seed failed.', error);
    process.exitCode = 1;
});
