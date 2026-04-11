import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "path";

const file = path.join(process.cwd(), "db/database.json");
const adapter = new JSONFile(file);

const defaultData = {
  users: [],
  messages: [],
  conversations: []
};

const db = new Low(adapter, defaultData);

await db.read();
db.data ||= defaultData;
await db.write();

export default db;
