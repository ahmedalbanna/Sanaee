import express from 'express';
import path from 'path';
import Stripe from 'stripe';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
