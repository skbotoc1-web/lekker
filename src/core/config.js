import 'dotenv/config';

export const config = {
  app: {
    name: 'lekker',
    port: Number(process.env.PORT || 8787),
    baseUrl: process.env.BASE_URL || 'http://localhost:8787',
    locale: 'de-CH',
    timezone: process.env.TZ || 'Europe/Zurich'
  },
  data: {
    dbPath: process.env.DB_PATH || './data/lekker.db'
  },
  mail: {
    enabled: process.env.SMTP_ENABLED === 'true',
    from: process.env.SMTP_FROM || 'lekker-bot@example.com',
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    to: process.env.REVIEW_EMAIL_TO || 'sk@stefankaiser.net'
  }
};
