// Loaded first (ES imports are hoisted, so this can't live inline in index.ts).
import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"], quiet: true });
