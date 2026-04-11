import mongoose from "mongoose";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("Missing MONGO_URI");
  }

  const maxRetries = Number(process.env.DB_MAX_RETRIES ?? 0); // 0 = retry forever
  const delayMs = Number(process.env.DB_RETRY_DELAY_MS ?? 2000);
  let attempt = 0;

  while (true) {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
      });
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      attempt += 1;
      console.log("MongoDB connection error:", error.message || error);

      if (maxRetries > 0 && attempt >= maxRetries) {
        throw error;
      }

      await wait(delayMs);
    }
  }
};
