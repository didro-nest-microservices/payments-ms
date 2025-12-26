import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import type { Request, Response } from 'express';
import { env } from 'src/config';
import Stripe from 'stripe';
import { NATS_SERVICE } from '../config/services';
import { PaymentSessionDto } from './dto/payment-session.dto';

@Injectable()
export class PaymentsService {
  private readonly stripe = new Stripe(env.stripeSecret);
  private readonly logger = new Logger('PaymentsService');

  constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {}

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

    return {
      cancelUrl: session.cancel_url,
      successUrl: session.success_url,
      url: session.url,
    };
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

      const payload = {
        paymentId: response.id,
        orderId: response.metadata.orderId,
        receiptUrl: response.receipt_url,
      };

      this.client.emit('payment.succeeded', payload);
    } else {
      this.logger.log(`Event ${event.type} not handeld`);
    }

    return res.status(200).json({ signature });
  }
}
