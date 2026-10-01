export default function handler(req: any, res: any) {
  res.status(200).json({
    status: 'ok',
    platform: 'ChatsApp Web Omnichannel',
    engine: 'Vercel Serverless Functions + Supabase Realtime',
    timestamp: new Date().toISOString(),
  });
}
