import express from 'express';
import path from 'path';
import Stripe from 'stripe';
import multer from 'multer';
import fs from 'fs';

const uploadDir = path.join(process.cwd(), 'public/audio');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: 'public/audio/' });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // --- API Routes ---
  
  // Create Stripe Checkout Session
  app.post('/api/create-checkout-session', async (req, res) => {
    try {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        throw new Error('STRIPE_SECRET_KEY is missing');
      }
      const stripe = new Stripe(stripeKey);
      
      const { jobId, craftId } = req.body;
      const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'yer', // Using Yemeni Rial or USD if YER not supported (Stripe uses USD generally for test)
              product_data: {
                name: `طلب مميز - ${craftId}`,
                description: 'إظهار طلبك في أعلى القائمة وتنبيه الحرفيين فوراً.',
              },
              unit_amount: 500 * 100, // 500 in cents, but if USD it's 500 cents = $5
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&job_id=${jobId}`,
        cancel_url: `${appUrl}/payment/cancel`,
      });

      res.json({ id: session.id, url: session.url });
    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // Upload Audio
  app.post('/api/upload-audio', (req, res, next) => {
    upload.single('audio')(req, res, (err) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(500).json({ error: 'Multer upload failed' });
      }
      next();
    });
  }, (req, res) => {
    console.log('Upload request received');
    if (!req.file) {
      console.log('No file in request');
      res.status(400).send('No file uploaded.');
      return;
    }
    console.log('File received:', req.file);
    // Rename to have .webm extension, essential for audio playback
    const oldPath = req.file.path;
    const newPath = req.file.path + '.webm';
    try {
        fs.renameSync(oldPath, newPath);
        res.json({ url: `/audio/${req.file.filename}.webm` });
    } catch(err) {
        console.error('File rename error:', err);
        res.status(500).json({ error: 'File processing failed' });
    }
  });

  // Serve static audio
  app.use('/audio', express.static(path.join(process.cwd(), 'public/audio')));

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Support Express v4 syntax
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
