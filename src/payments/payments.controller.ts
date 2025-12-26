import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type { Request, Response } from 'express';
import { PaymentSessionDto } from './dto/payment-session.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @MessagePattern('create.payment.session')
  session(@Payload() paymentSessionDto: PaymentSessionDto) {
    return this.paymentsService.createSession(paymentSessionDto);
  }

  @Get('success')
  success() {
    return 'success';
  }

  @Get('cancel')
  cancel() {
    return 'cancel';
  }

  @Post('webhook')
  webhook(@Req() req: Request, @Res() res: Response) {
    return this.paymentsService.stripeWebhook(req, res);
  }
}
