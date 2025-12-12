import { DatabaseSchema, AppSettings } from "@/lib/db/types";
import fs from "node:fs/promises";
import path from "node:path";
import { hashPassword } from "../utils/auth";

const DB_PATH = "backend/db/db.json";

const DEFAULT_SETTINGS: AppSettings = {
  companyName: { en: "Rork Travel", ar: "Rork Travel", de: "Rork Travel" },
  termsAndConditions: { en: "", ar: "", de: "" },
  privacyPolicy: { en: "", ar: "", de: "" },
  contact: {
    email: "info@rork.app",
    phone: "",
    whatsapp: "",
    address: { en: "", ar: "", de: "" },
  },
  about: {
    section1Title: { en: "", ar: "", de: "" },
    section1Content: { en: "", ar: "", de: "" },
    missionTitle: { en: "", ar: "", de: "" },
    missionContent: { en: "", ar: "", de: "" },
    visionTitle: { en: "", ar: "", de: "" },
    visionContent: { en: "", ar: "", de: "" },
  },
  hero: {
    title: { en: "", ar: "", de: "" },
    subtitle: { en: "", ar: "", de: "" },
    buttonText: { en: "", ar: "", de: "" },
  },
  heroSlides: [],
  images: {
    heroBackground: "",
    welcomeBackground: "",
    authBackground: "",
    logoUrl: "",
  },
};


const DEFAULT_DB: DatabaseSchema = {
  users: [],
  categories: [],
  packages: [],
  bookings: [],
  conversations: [],
  messages: [],
  blogs: [],
  faqs: [],
  settings: DEFAULT_SETTINGS,
  sessions: {},
};

class JSONDatabase {
  private data: DatabaseSchema;
  private loaded: boolean = false;

  constructor() {
    this.data = structuredClone(DEFAULT_DB);
  }

  async init() {
    if (this.loaded) return;
    try {
      // check if directory exists
      // await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
      
      try {
        const content = await fs.readFile(DB_PATH, "utf-8");
        this.data = JSON.parse(content);
      } catch (_) {
        // If file doesn't exist or is invalid, use default
        throw new Error("File not found");
      }
      
      // Ensure defaults
      if (!this.data.settings) this.data.settings = DEFAULT_SETTINGS;
      if (!this.data.users) this.data.users = [];
      if (!this.data.settings.heroSlides) this.data.settings.heroSlides = [];
      if (!this.data.sessions) this.data.sessions = {};

      // Seed Admin
      const adminExists = this.data.users.find(u => u.email === "admin" || u.role === "admin");
      if (!adminExists) {
        this.data.users.push({
          id: "admin",
          email: "admin",
          name: "Administrator",
          role: "admin",
          passwordHash: hashPassword("admin123"),
          preferredLanguage: "en",
          createdAt: new Date().toISOString(),
          status: "active"
        });
        await this.save();
      }

      console.log("Database loaded from", DB_PATH);
    } catch (_) {
      console.log("Database not found or invalid, creating new one at", DB_PATH);
      await this.save();
    }
    this.loaded = true;
  }

  // Helper to ensure DB is ready
  async waitForInit() {
    if (this.loaded) return;
    await this.init();
  }

  async save() {
    // await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(this.data, null, 2));
  }

  get() {
    if (!this.loaded) throw new Error("Database not initialized");
    return this.data;
  }
}

export const db = new JSONDatabase();

// Initialize immediately (will be async but module cache helps)
db.init().catch(console.error);
