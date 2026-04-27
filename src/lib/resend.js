import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY || 're_xxxxxxxxx';

export const resend = new Resend(apiKey);
