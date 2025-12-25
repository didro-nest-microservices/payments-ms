import { Injectable, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { env } from 'src/config';
import Stripe from 'stripe';
import { PaymentSessionDto } from './dto/payment-session.dto';

@Injectable()
export class PaymentsService {
  private readonly stripe = new Stripe(env.stripeSecret);
  private logger = new Logger('PaymentsService');

  async createSession(paymentSessionDto: PaymentSessionDto) {
    const { currency, items, orderId } = paymentSessionDto;

    const lineItems = items.map((item) => ({
      price_data: {
        currency,
        product_data: {
          name: item.name,
        },
        unit_amount: Math.round(item.price * 100), // example -> 20 dollars: 20.00 * 100 = 2000
      },
      quantity: item.quantity,
    }));

    const session = await this.stripe.checkout.sessions.create({
      payment_intent_data: {
        metadata: { orderId },
      },
      line_items: lineItems,
      mode: 'payment',
      success_url: env.stripeSuccessUrl,
      cancel_url: env.stripeCancelUrl,
    });
    return session;
  }

  stripeWebhook(req: Request, res: Response) {
    const signature = req.headers['stripe-signature'] as string;
    let event: Stripe.Event;
    const endpointSecret = env.stripeEndpointSecret;

    try {
      event = this.stripe.webhooks.constructEvent(
        req['rawBody'],
        signature,
        endpointSecret,
      );
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'charge.succeeded') {
      const response = event.data.object;
      console.log('received', response.metadata);
    } else {
      this.logger.log(`Event ${event.type} not handeld`);
    }

    return res.status(200).json({ signature });
  }
}
